"""
Tests for the ODBC connection-string builder. The brace-escape logic in
particular has had two regressions in production — every fix here should
have a paired test below.
"""

import pytest

# pyodbc requires unixodbc on macOS, so allow the test module to be skipped
# entirely if the import fails on dev boxes without the system library.
pyodbc = pytest.importorskip("pyodbc", exc_type=ImportError)

from services.db_connector import DBConnector, _brace  # noqa: E402


# ---------- _brace ---------- #

def test_brace_wraps_value():
    assert _brace("hello") == "{hello}"


def test_brace_handles_special_chars_unescaped():
    # The whole point: characters that would normally terminate an ODBC
    # attribute should survive intact between the braces.
    pwd = "JCc_=*9zz+F{g'Q[9Rgza|W29;d3cb-c"
    assert _brace(pwd) == "{" + pwd + "}"


def test_brace_doubles_closing_brace():
    # `}` is the only character that needs escaping inside `{...}`.
    assert _brace("foo}bar") == "{foo}}bar}"
    assert _brace("}}") == "{}}}}}"


def test_brace_handles_none_and_empty():
    assert _brace(None) == ""
    assert _brace("") == "{}"


# ---------- _build_connection_string ---------- #

def test_sql_auth_connection_string_braces_credentials():
    conn = DBConnector({
        "server": "host.example",
        "port": 1433,
        "database": "AdventureWorks",
        "auth_type": "sql_auth",
        "username": "svc;user",  # nasty username
        "password": "p=w;d{xx",  # nasty password
    })
    s = conn._build_connection_string()
    assert "UID={svc;user};" in s
    assert "PWD={p=w;d{xx};" in s


def test_sql_auth_includes_optional_encryption():
    # Encrypt=Optional + TrustServerCertificate=yes is what unblocks internal
    # SQL Servers under ODBC Driver 18's stricter `Mandatory` default.
    conn = DBConnector({
        "server": "host", "port": 1433, "database": "db",
        "auth_type": "sql_auth", "username": "u", "password": "p",
    })
    s = conn._build_connection_string()
    assert "Encrypt=Optional" in s
    assert "TrustServerCertificate=yes" in s


def test_windows_auth_connection_string_uses_trusted_connection():
    conn = DBConnector({
        "server": "host", "database": "db", "auth_type": "windows",
    })
    s = conn._build_connection_string()
    assert "Trusted_Connection=yes" in s
    assert "UID=" not in s
    assert "PWD=" not in s
