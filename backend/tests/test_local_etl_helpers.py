"""
Pure-helper tests for the local ETL blueprint. These cover the small but
load-bearing functions whose bugs would silently corrupt data — type
mapping (wrong DDL), identifier quoting (SQL injection / break), lineage
column constants.
"""

import pytest

# api.local_etl transitively imports pyodbc via services.db_connector.
# On dev machines without unixODBC the pyodbc binary fails to load — skip
# the suite cleanly there. CI runs on Windows where pyodbc imports fine.
pytest.importorskip("pyodbc", exc_type=ImportError)

from api.local_etl import (  # noqa: E402
    LINEAGE_COLUMNS,
    LINEAGE_NAMES,
    _map_duckdb_type,
    _qualified,
    _quote_ident,
)


# ---------- _quote_ident ---------- #

def test_quote_ident_wraps_in_brackets():
    assert _quote_ident("customers") == "[customers]"


def test_quote_ident_escapes_closing_bracket():
    # SQL Server's bracket-escape rule: ] becomes ]].
    assert _quote_ident("weird]name") == "[weird]]name]"


def test_quote_ident_handles_spaces_and_dashes():
    assert _quote_ident("Customer Address") == "[Customer Address]"
    assert _quote_ident("source-2026-01") == "[source-2026-01]"


def test_qualified_joins_schema_and_table():
    assert _qualified("dbo", "customers") == "[dbo].[customers]"


# ---------- _map_duckdb_type ---------- #

def test_map_duckdb_type_integers():
    assert _map_duckdb_type("BIGINT") == "BIGINT"
    assert _map_duckdb_type("INTEGER") == "INT"
    assert _map_duckdb_type("INT") == "INT"
    assert _map_duckdb_type("SMALLINT") == "SMALLINT"
    assert _map_duckdb_type("TINYINT") == "TINYINT"


def test_map_duckdb_type_decimals_pass_through():
    # Precision and scale must survive untouched.
    assert _map_duckdb_type("DECIMAL(10,2)") == "DECIMAL(10,2)"
    # NUMERIC is a SQL Server alias — normalize.
    assert _map_duckdb_type("NUMERIC(18,4)") == "DECIMAL(18,4)"


def test_map_duckdb_type_floats_and_bool():
    assert _map_duckdb_type("DOUBLE") == "FLOAT"
    assert _map_duckdb_type("FLOAT") == "REAL"
    assert _map_duckdb_type("BOOLEAN") == "BIT"


def test_map_duckdb_type_temporal():
    assert _map_duckdb_type("DATE") == "DATE"
    assert _map_duckdb_type("TIMESTAMP") == "DATETIME2"
    assert _map_duckdb_type("TIMESTAMPTZ") == "DATETIMEOFFSET"
    assert _map_duckdb_type("TIME") == "TIME"


def test_map_duckdb_type_unknown_falls_back_to_nvarchar():
    # Unknown types should never break a load — default to a safe text type.
    assert _map_duckdb_type("VARCHAR") == "NVARCHAR(MAX)"
    assert _map_duckdb_type("SOMETHING_NEW") == "NVARCHAR(MAX)"
    assert _map_duckdb_type("") == "NVARCHAR(MAX)"
    assert _map_duckdb_type(None) == "NVARCHAR(MAX)"  # type: ignore[arg-type]


def test_map_duckdb_type_is_case_insensitive():
    assert _map_duckdb_type("bigint") == "BIGINT"
    assert _map_duckdb_type("Date") == "DATE"


# ---------- lineage columns ---------- #

def test_lineage_columns_has_expected_shape():
    names = [c["name"] for c in LINEAGE_COLUMNS]
    assert names == ["_source_name", "_loaded_at"]
    assert all(c["nullable"] for c in LINEAGE_COLUMNS)


def test_lineage_names_matches_columns():
    assert LINEAGE_NAMES == [c["name"] for c in LINEAGE_COLUMNS]
