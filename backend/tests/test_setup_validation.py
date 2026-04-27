"""
Tests for the setup blueprint's input validation. We don't talk to a real
SQL Server — just verify that bad input is rejected cleanly with helpful
error messages, since this is the user's first interaction with the app.
"""

import pytest

# Setup blueprint imports DBConnector which imports pyodbc; gate the module.
pytest.importorskip("pyodbc", exc_type=ImportError)

from api.setup import _validated  # noqa: E402


def test_validated_returns_dict_for_well_formed_input():
    cfg = _validated({
        "host": "sql.example",
        "port": 1433,
        "user": "svc",
        "password": "p;w",
        "database": "ms3dm_metadata",
    })
    assert isinstance(cfg, dict)
    assert cfg["host"] == "sql.example"
    assert cfg["port"] == 1433
    assert cfg["database"] == "ms3dm_metadata"


def test_validated_strips_whitespace():
    cfg = _validated({
        "host": "  sql.example  ",
        "user": "  svc  ",
        "password": "p",
    })
    assert cfg["host"] == "sql.example"
    assert cfg["user"] == "svc"
    # Password is intentionally NOT stripped — leading/trailing spaces are
    # part of the credential.
    assert cfg["password"] == "p"


def test_validated_defaults_port_and_database():
    cfg = _validated({"host": "h", "user": "u", "password": "p"})
    assert cfg["port"] == 1433
    assert cfg["database"] == "ms3dm_metadata"


def test_validated_rejects_missing_host():
    result = _validated({"user": "u", "password": "p"})
    # The validator returns a Flask response tuple on error.
    assert isinstance(result, tuple)
    response, status = result
    assert status == 400
    assert "host" in response.get_json()["error"].lower()


def test_validated_rejects_missing_password():
    result = _validated({"host": "h", "user": "u"})
    assert isinstance(result, tuple)
    _, status = result
    assert status == 400


def test_validated_rejects_non_integer_port():
    result = _validated({
        "host": "h", "user": "u", "password": "p", "port": "not-a-number",
    })
    assert isinstance(result, tuple)
    response, status = result
    assert status == 400
    assert "port" in response.get_json()["error"].lower()
