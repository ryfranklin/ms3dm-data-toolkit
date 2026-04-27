"""
Value coercion tests — these are the rules that decide how a CSV string
becomes the right Python type for SQL Server. Bugs here silently corrupt
data (or cause confusing pyodbc errors), so they earn dense coverage.
"""
from datetime import date, datetime
from decimal import Decimal

import pytest

# api.local_etl transitively imports pyodbc; skip cleanly on Macs without
# unixodbc. CI / Docker runner have it installed.
pytest.importorskip("pyodbc", exc_type=ImportError)

from api.local_etl import _coerce_row, _coerce_value  # noqa: E402


# ---------- empty / whitespace / None ---------- #

def test_none_passes_through():
    assert _coerce_value(None, "INT") is None


def test_empty_string_becomes_none_for_any_type():
    for t in ("INT", "BIGINT", "DECIMAL(10,2)", "FLOAT", "BIT", "DATE", "NVARCHAR(MAX)"):
        assert _coerce_value("", t) is None
        assert _coerce_value("   ", t) is None


def test_already_typed_values_pass_through():
    # DuckDB native reads return Decimals, datetimes, etc. — don't try to
    # re-parse those.
    d = Decimal("42.5")
    assert _coerce_value(d, "DECIMAL(10,2)") is d
    dt = datetime(2026, 1, 2, 3, 4, 5)
    assert _coerce_value(dt, "DATETIME2") is dt


# ---------- numerics: thousands-separator commas ---------- #

def test_int_strips_commas():
    assert _coerce_value("1,234", "INT") == 1234
    assert _coerce_value("1,234,567", "BIGINT") == 1234567


def test_decimal_strips_commas_preserves_precision():
    # The exact failure from production: TX-Copay = "1,010.94" against DOUBLE.
    assert _coerce_value("1,010.94", "DECIMAL(18,2)") == Decimal("1010.94")
    # Decimal precision is preserved (no float rounding).
    assert _coerce_value("12,345.6789", "DECIMAL(20,4)") == Decimal("12345.6789")


def test_float_strips_commas():
    assert _coerce_value("1,010.94", "FLOAT") == pytest.approx(1010.94)
    assert _coerce_value("100", "REAL") == 100.0


def test_negative_and_decimal_signs():
    assert _coerce_value("-42", "INT") == -42
    assert _coerce_value("-1,234.56", "DECIMAL(10,2)") == Decimal("-1234.56")


def test_invalid_numeric_raises_with_value():
    with pytest.raises(ValueError, match="not-a-num"):
        _coerce_value("not-a-num", "INT")
    with pytest.raises(ValueError, match="abc"):
        _coerce_value("abc", "DECIMAL(10,2)")


# ---------- dates ---------- #

def test_date_us_format():
    assert _coerce_value("12/04/25", "DATE") == date(2025, 12, 4)
    assert _coerce_value("12/04/2025", "DATE") == date(2025, 12, 4)


def test_date_iso_format():
    assert _coerce_value("2026-01-15", "DATE") == date(2026, 1, 15)


def test_date_placeholders_become_none():
    # Common in pharmacy/billing exports — represent "no date" as 00/00/00.
    assert _coerce_value("00/00/00", "DATE") is None
    assert _coerce_value("00/00/0000", "DATE") is None
    assert _coerce_value("0000-00-00", "DATE") is None


def test_invalid_date_raises():
    with pytest.raises(ValueError, match="13/45"):
        _coerce_value("13/45/2025", "DATE")


def test_datetime_formats():
    assert _coerce_value("2026-01-15 14:30:00", "DATETIME2") == datetime(2026, 1, 15, 14, 30, 0)
    assert _coerce_value("2026-01-15T14:30:00", "DATETIME2") == datetime(2026, 1, 15, 14, 30, 0)


# ---------- BIT ---------- #

def test_bit_truthy_strings():
    for s in ("1", "true", "True", "YES", "y", "t"):
        assert _coerce_value(s, "BIT") is True


def test_bit_falsy_strings():
    for s in ("0", "false", "False", "NO", "n", "f"):
        assert _coerce_value(s, "BIT") is False


def test_bit_unknown_raises():
    with pytest.raises(ValueError):
        _coerce_value("maybe", "BIT")


# ---------- text ---------- #

def test_nvarchar_trims_whitespace():
    # Trim is intentional — CSV exports often pad fields. Real leading
    # whitespace is rare and easy to add an opt-out for if it ever matters.
    assert _coerce_value("  hello  ", "NVARCHAR(MAX)") == "hello"
    assert _coerce_value("FVHC", "NVARCHAR(255)") == "FVHC"


def test_nvarchar_keeps_special_chars():
    # No mangling for text targets.
    assert _coerce_value("1,010.94", "NVARCHAR(MAX)") == "1,010.94"


# ---------- _coerce_row ---------- #

def test_coerce_row_attaches_column_name_to_error():
    columns = [
        {"name": "id", "type": "INT"},
        {"name": "TX-Copay", "type": "DECIMAL(18,2)"},
    ]
    with pytest.raises(ValueError, match="TX-Copay"):
        _coerce_row(["1", "garbage"], columns, ["id", "TX-Copay"])


def test_coerce_row_passes_through_extra_lineage_values():
    # Lineage values (real Python types) live past the user columns and
    # shouldn't be touched — _coerce_row should leave them intact.
    columns = [{"name": "amt", "type": "DECIMAL(18,2)"}]
    col_names = ["amt", "_source_name", "_loaded_at"]
    loaded_at = datetime(2026, 1, 1)
    out = _coerce_row(["1,010.94", "DEC25TRANS.CSV", loaded_at], columns, col_names)
    assert out == [Decimal("1010.94"), "DEC25TRANS.CSV", loaded_at]
