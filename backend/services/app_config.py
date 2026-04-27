"""
App config — bootstrap configuration for the MetadataStore connection.

Resolution order:
  1. `%APPDATA%/ms3dm-toolkit/config.json` on Windows,
     `~/Library/Application Support/ms3dm-toolkit/config.json` on macOS,
     `~/.config/ms3dm-toolkit/config.json` elsewhere.
  2. Environment variables (`MS3DM_METADATA_HOST`, etc.) — preserves the
     existing dev/Docker workflow when no config file is present.

Returns None when neither source has any settings, which puts the app into
"setup mode" so the first-run wizard can collect SQL Server credentials.
"""

import json
import os
from pathlib import Path

CONFIG_DIR_NAME = "ms3dm-toolkit"
CONFIG_FILE_NAME = "config.json"

# Single source of truth for the default metadata DB name. Imported by the
# setup blueprint, MetadataStore, and the frontend SetupScreen via a copy.
# Users can pick a different name during first-run setup and the app will
# create whatever they choose.
DEFAULT_DATABASE_NAME = "DataToolkit"

REQUIRED_FIELDS = ("host", "user", "password", "database")


def config_dir() -> Path:
    """Return the per-user config directory, creating it if needed."""
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA") or Path.home() / "AppData" / "Roaming")
    elif os.uname().sysname == "Darwin":  # type: ignore[attr-defined]
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config")
    path = base / CONFIG_DIR_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


def config_path() -> Path:
    return config_dir() / CONFIG_FILE_NAME


def _load_from_file() -> dict | None:
    p = config_path()
    if not p.is_file():
        return None
    try:
        with p.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return None
    md = data.get("metadata") or {}
    if not all(md.get(k) for k in REQUIRED_FIELDS):
        return None
    return {
        "host": md["host"],
        "port": int(md.get("port", 1433)),
        "user": md["user"],
        "password": md["password"],
        "database": md.get("database", DEFAULT_DATABASE_NAME),
    }


def _load_from_env() -> dict | None:
    host = os.getenv("MS3DM_METADATA_HOST")
    user = os.getenv("MS3DM_METADATA_USER")
    password = os.getenv("MS3DM_METADATA_PASSWORD")
    if not (host and user and password):
        return None
    return {
        "host": host,
        "port": int(os.getenv("MS3DM_METADATA_PORT", "1433")),
        "user": user,
        "password": password,
        "database": os.getenv("MS3DM_METADATA_DATABASE", DEFAULT_DATABASE_NAME),
    }


def load_metadata_config() -> dict | None:
    """Return the resolved MetadataStore connection dict, or None if unset."""
    return _load_from_file() or _load_from_env()


def save_metadata_config(cfg: dict) -> Path:
    """Persist a MetadataStore config dict to the user-config file. Returns the path."""
    missing = [k for k in REQUIRED_FIELDS if not cfg.get(k)]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")
    payload = {
        "metadata": {
            "host": cfg["host"],
            "port": int(cfg.get("port", 1433)),
            "user": cfg["user"],
            "password": cfg["password"],
            "database": cfg.get("database", DEFAULT_DATABASE_NAME),
        }
    }
    p = config_path()
    with p.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    # Tighten perms on POSIX so the password isn't world-readable.
    if os.name != "nt":
        try:
            os.chmod(p, 0o600)
        except OSError:
            pass
    return p


def is_configured() -> bool:
    return load_metadata_config() is not None
