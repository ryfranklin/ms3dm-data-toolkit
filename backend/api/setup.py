"""
Setup API Blueprint

Bootstraps the MetadataStore connection on first run. The blueprint is
intentionally independent of the MetadataStore (since the store may not yet
exist when these endpoints are called).
"""

from flask import Blueprint, current_app, jsonify, request

from services.app_config import (
    DEFAULT_DATABASE_NAME,
    config_path,
    is_configured,
    load_metadata_config,
    save_metadata_config,
)
from services.db_connector import DBConnector
from services.metadata_store import MetadataStore

setup_bp = Blueprint("setup", __name__)


@setup_bp.route("/status", methods=["GET"])
def status():
    """
    Tell the frontend whether the app needs first-run setup.
    Returns the current host/database (no password) when configured so the
    user can verify they're pointing at the right server.
    """
    cfg = load_metadata_config()
    if not cfg or current_app.config.get("METADATA_STORE") is None:
        return jsonify({
            "data": {
                "configured": False,
                "needs_setup": True,
                "config_path": str(config_path()),
            }
        }), 200
    return jsonify({
        "data": {
            "configured": True,
            "needs_setup": False,
            "host": cfg["host"],
            "port": cfg["port"],
            "database": cfg["database"],
            "user": cfg["user"],
            "config_path": str(config_path()),
        }
    }), 200


@setup_bp.route("/test", methods=["POST"])
def test_connection():
    """
    Try connecting with the supplied credentials without persisting them.
    Lets the setup wizard show a green checkmark before the user clicks Save.
    """
    body = request.get_json(silent=True) or {}
    cfg = _validated(body)
    if isinstance(cfg, tuple):
        err, status = cfg
        return jsonify(err), status

    try:
        connector = DBConnector({
            "server": cfg["host"],
            "port": cfg["port"],
            "database": "master",  # connect to master to avoid db-not-exists errors
            "auth_type": "sql_auth",
            "username": cfg["user"],
            "password": cfg["password"],
        })
        ok, message = connector.test_connection()
        connector.disconnect()
    except Exception as exc:
        return jsonify({"error": f"Connection failed: {exc}"}), 400

    if not ok:
        return jsonify({"error": message}), 400
    return jsonify({"data": {"success": True, "message": message}}), 200


@setup_bp.route("/configure", methods=["POST"])
def configure():
    """
    Persist the metadata connection config and hot-init the MetadataStore.
    The store creates the metadata database (CREATE DATABASE IF NOT EXISTS)
    so the user only needs CREATE DATABASE permission, not a pre-made db.
    """
    body = request.get_json(silent=True) or {}
    cfg = _validated(body)
    if isinstance(cfg, tuple):
        err, status = cfg
        return jsonify(err), status

    # Verify before persisting — easier to recover from a typo here than after.
    try:
        store = MetadataStore(cfg)
        store.initialize()
    except Exception as exc:
        return jsonify({"error": f"Failed to initialize metadata store: {exc}"}), 400

    try:
        path = save_metadata_config(cfg)
    except Exception as exc:
        return jsonify({"error": f"Failed to save config: {exc}"}), 500

    current_app.config["METADATA_STORE"] = store
    return jsonify({
        "message": "Setup complete",
        "data": {
            "configured": True,
            "config_path": str(path),
            "database": cfg["database"],
        },
    }), 200


def _validated(body: dict):
    """
    Pure validator — returns a clean cfg dict on success, or a
    `({"error": ...}, status)` tuple on failure. Keeping this off Flask's
    response stack lets it be unit-tested without an app context.
    """
    host = (body.get("host") or "").strip()
    user = (body.get("user") or "").strip()
    password = body.get("password") or ""
    database = (body.get("database") or DEFAULT_DATABASE_NAME).strip()
    try:
        port = int(body.get("port") or 1433)
    except (TypeError, ValueError):
        return {"error": "port must be an integer"}, 400

    missing = [k for k, v in (("host", host), ("user", user), ("password", password)) if not v]
    if missing:
        return {"error": f"Missing required field(s): {', '.join(missing)}"}, 400

    return {"host": host, "port": port, "user": user, "password": password, "database": database}


# Re-export for app.py's `from api.setup import setup_bp` line.
__all__ = ["setup_bp"]


# Helper used by the gate logic in app.py — exposed for tests if needed later.
def configured() -> bool:
    return is_configured()
