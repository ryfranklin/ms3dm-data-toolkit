"""
App config (first-run wizard's persistence layer) tests. These exercise the
file <-> env fallback that keeps both the Docker dev path AND the desktop
bundle working from the same code.
"""

import json

import pytest

from services import app_config


@pytest.fixture
def isolated_config_dir(tmp_path, monkeypatch):
    """Force the resolver to use a per-test temp dir."""
    monkeypatch.setattr(app_config, "config_dir", lambda: tmp_path)
    return tmp_path


def test_load_returns_none_when_no_file_or_env(isolated_config_dir, monkeypatch):
    for var in (
        "MS3DM_METADATA_HOST", "MS3DM_METADATA_USER",
        "MS3DM_METADATA_PASSWORD", "MS3DM_METADATA_DATABASE",
    ):
        monkeypatch.delenv(var, raising=False)
    assert app_config.load_metadata_config() is None
    assert app_config.is_configured() is False


def test_save_then_load_round_trip(isolated_config_dir):
    cfg = {
        "host": "sql.example",
        "port": 1433,
        "user": "svc",
        "password": "p;w=d{x",  # special chars survive JSON roundtrip
        "database": "DataToolkit",
    }
    path = app_config.save_metadata_config(cfg)
    assert path.is_file()
    loaded = app_config.load_metadata_config()
    assert loaded == cfg


def test_save_rejects_missing_required_fields(isolated_config_dir):
    with pytest.raises(ValueError, match="Missing required fields"):
        app_config.save_metadata_config({"host": "h"})


def test_load_falls_back_to_env_when_file_missing(isolated_config_dir, monkeypatch):
    monkeypatch.setenv("MS3DM_METADATA_HOST", "env.example")
    monkeypatch.setenv("MS3DM_METADATA_USER", "env_user")
    monkeypatch.setenv("MS3DM_METADATA_PASSWORD", "env_pw")
    monkeypatch.setenv("MS3DM_METADATA_DATABASE", "env_db")
    monkeypatch.setenv("MS3DM_METADATA_PORT", "1444")

    cfg = app_config.load_metadata_config()
    assert cfg == {
        "host": "env.example",
        "port": 1444,
        "user": "env_user",
        "password": "env_pw",
        "database": "env_db",
    }


def test_file_takes_precedence_over_env(isolated_config_dir, monkeypatch):
    monkeypatch.setenv("MS3DM_METADATA_HOST", "should_lose")
    monkeypatch.setenv("MS3DM_METADATA_USER", "u")
    monkeypatch.setenv("MS3DM_METADATA_PASSWORD", "p")

    app_config.save_metadata_config({
        "host": "should_win",
        "port": 1433,
        "user": "file_user",
        "password": "file_pw",
        "database": "file_db",
    })

    cfg = app_config.load_metadata_config()
    assert cfg["host"] == "should_win"
    assert cfg["user"] == "file_user"


def test_load_returns_none_when_file_lacks_required_fields(isolated_config_dir):
    # Truncated / incomplete config files shouldn't crash — they should
    # fall through to env and ultimately surface the setup screen again.
    (isolated_config_dir / app_config.CONFIG_FILE_NAME).write_text(
        json.dumps({"metadata": {"host": "h"}}), encoding="utf-8",
    )
    assert app_config.load_metadata_config() is None


def test_load_returns_none_when_file_is_garbage(isolated_config_dir):
    (isolated_config_dir / app_config.CONFIG_FILE_NAME).write_text(
        "not json at all", encoding="utf-8",
    )
    assert app_config.load_metadata_config() is None
