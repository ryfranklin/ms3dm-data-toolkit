"""
Local ETL API Blueprint

Endpoints for managing local file storage, uploading data files,
inspecting schemas, and executing SQL queries via DuckDB.

Also hosts the file → SQL Server pipeline endpoints (list connections,
inspect destination tables, execute a load, save/list pipeline definitions).
"""

import csv
import io
import os
import time
import uuid
from datetime import datetime
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, send_file
from werkzeug.utils import secure_filename

from services.db_connector import DBConnector
from services.duckdb_query import (
    SUPPORTED_EXTENSIONS,
    describe_file,
    execute_query,
    read_file_rows,
)

local_etl_bp = Blueprint("local_etl", __name__)

DEFAULT_STORAGE_PATH = "./local_storage"
SETTINGS_KEY = "local_etl_storage_path"
MAX_UPLOAD_SIZE = 200 * 1024 * 1024  # 200 MB


def _get_storage_path() -> str:
    """Get the configured storage directory path."""
    store = current_app.config["METADATA_STORE"]
    path = store.get_setting(SETTINGS_KEY)
    return path or DEFAULT_STORAGE_PATH


def _resolve_storage_path() -> str:
    """Get the absolute resolved storage path."""
    return os.path.realpath(_get_storage_path())


# ------------------------------------------------------------------ #
#  Settings
# ------------------------------------------------------------------ #


@local_etl_bp.route("/settings", methods=["GET"])
def get_settings():
    """Return the current storage directory path."""
    return jsonify({"data": {"storage_path": _get_storage_path()}}), 200


@local_etl_bp.route("/settings", methods=["PUT"])
def update_settings():
    """Update the storage directory path. Creates the directory if it doesn't exist."""
    body = request.get_json(silent=True) or {}
    path = body.get("storage_path", "").strip()
    if not path:
        return jsonify({"error": "storage_path is required"}), 400

    resolved = os.path.realpath(path)
    try:
        os.makedirs(resolved, exist_ok=True)
    except OSError as exc:
        return jsonify({"error": f"Cannot create directory: {exc}"}), 400

    if not os.path.isdir(resolved):
        return jsonify({"error": "Path is not a valid directory"}), 400

    store = current_app.config["METADATA_STORE"]
    store.set_setting(SETTINGS_KEY, path)
    return jsonify({"message": "Storage path updated", "data": {"storage_path": path}}), 200


# ------------------------------------------------------------------ #
#  Directory browser (for settings modal)
# ------------------------------------------------------------------ #


@local_etl_bp.route("/browse", methods=["GET"])
def browse_directories():
    """List directories at the given path (for the directory picker UI)."""
    raw_path = request.args.get("path", "/")
    resolved = os.path.realpath(raw_path)

    if not os.path.isdir(resolved):
        return jsonify({"error": "Not a valid directory"}), 400

    entries = []
    try:
        for entry in sorted(os.scandir(resolved), key=lambda e: e.name):
            if entry.is_dir() and not entry.name.startswith("."):
                entries.append({"name": entry.name, "type": "directory"})
    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403

    return jsonify({
        "data": {
            "path": resolved,
            "parent": os.path.dirname(resolved) if resolved != "/" else None,
            "entries": entries,
        }
    }), 200


# ------------------------------------------------------------------ #
#  File management
# ------------------------------------------------------------------ #


@local_etl_bp.route("/files", methods=["GET"])
def list_files():
    """List data files in the storage directory."""
    storage = _resolve_storage_path()
    if not os.path.isdir(storage):
        return jsonify({"data": {"files": [], "storage_path": _get_storage_path()}}), 200

    files = []
    for filename in sorted(os.listdir(storage)):
        ext = Path(filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue
        filepath = os.path.join(storage, filename)
        if not os.path.isfile(filepath):
            continue
        stat = os.stat(filepath)
        files.append({
            "name": filename,
            "size": stat.st_size,
            "modified": stat.st_mtime,
            "type": ext.lstrip("."),
        })

    return jsonify({"data": {"files": files, "storage_path": _get_storage_path()}}), 200


@local_etl_bp.route("/upload", methods=["POST"])
def upload_file():
    """Upload a data file to the storage directory."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No filename"}), 400

    safe_name = secure_filename(file.filename)
    if not safe_name:
        return jsonify({"error": "Invalid filename"}), 400

    ext = Path(safe_name).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        return jsonify({
            "error": f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        }), 400

    # Check content length if available
    if request.content_length and request.content_length > MAX_UPLOAD_SIZE:
        return jsonify({"error": f"File too large. Maximum size: {MAX_UPLOAD_SIZE // (1024*1024)} MB"}), 400

    storage = _resolve_storage_path()
    os.makedirs(storage, exist_ok=True)

    dest = os.path.join(storage, safe_name)
    file.save(dest)

    stat = os.stat(dest)
    return jsonify({
        "message": f"Uploaded {safe_name}",
        "data": {
            "name": safe_name,
            "size": stat.st_size,
            "modified": stat.st_mtime,
            "type": ext.lstrip("."),
        },
    }), 201


@local_etl_bp.route("/files/<filename>", methods=["DELETE"])
def delete_file(filename: str):
    """Delete a file from the storage directory."""
    # Reject path separators to prevent traversal
    if "/" in filename or "\\" in filename:
        return jsonify({"error": "Invalid filename"}), 400

    safe_name = secure_filename(filename)
    if not safe_name:
        return jsonify({"error": "Invalid filename"}), 400

    storage = _resolve_storage_path()
    filepath = os.path.join(storage, safe_name)

    if not os.path.isfile(filepath):
        return jsonify({"error": "File not found"}), 404

    os.remove(filepath)
    return jsonify({"message": f"Deleted {safe_name}"}), 200


# ------------------------------------------------------------------ #
#  Schema inspection
# ------------------------------------------------------------------ #


@local_etl_bp.route("/schema/<filename>", methods=["GET"])
def get_schema(filename: str):
    """Get column names and types for a file via DuckDB DESCRIBE."""
    if "/" in filename or "\\" in filename:
        return jsonify({"error": "Invalid filename"}), 400

    safe_name = secure_filename(filename)
    storage = _resolve_storage_path()
    filepath = os.path.join(storage, safe_name)

    if not os.path.isfile(filepath):
        return jsonify({"error": "File not found"}), 404

    try:
        columns = describe_file(filepath)
    except Exception as exc:
        return jsonify({"error": f"Failed to read schema: {exc}"}), 400

    return jsonify({"data": {"filename": safe_name, "columns": columns}}), 200


# ------------------------------------------------------------------ #
#  Query execution
# ------------------------------------------------------------------ #


@local_etl_bp.route("/query", methods=["POST"])
def run_query():
    """Execute a SQL query against files in the storage directory."""
    body = request.get_json(silent=True) or {}
    sql = body.get("sql", "").strip()
    if not sql:
        return jsonify({"error": "sql is required"}), 400

    limit = min(int(body.get("limit", 10_000)), 100_000)
    storage = _resolve_storage_path()

    try:
        result = execute_query(sql, storage, limit=limit)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"data": result}), 200


@local_etl_bp.route("/query/export", methods=["POST"])
def export_query():
    """Execute a SQL query and return the result as a downloadable CSV."""
    body = request.get_json(silent=True) or {}
    sql = body.get("sql", "").strip()
    if not sql:
        return jsonify({"error": "sql is required"}), 400

    storage = _resolve_storage_path()

    try:
        result = execute_query(sql, storage, limit=100_000)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(result["columns"])
    writer.writerows(result["rows"])

    buf = io.BytesIO(output.getvalue().encode("utf-8"))
    buf.seek(0)

    return send_file(
        buf,
        mimetype="text/csv",
        as_attachment=True,
        download_name="query_results.csv",
    )


# ====================================================================== #
#  ETL Pipelines: file → SQL Server load
# ====================================================================== #

# DuckDB type → SQL Server type mapping. Anything not matched here falls
# back to NVARCHAR(MAX) (the safe choice for unknown text-like data).
_TYPE_MAP = {
    "BIGINT": "BIGINT",
    "INT64": "BIGINT",
    "INTEGER": "INT",
    "INT": "INT",
    "INT32": "INT",
    "SMALLINT": "SMALLINT",
    "INT16": "SMALLINT",
    "TINYINT": "TINYINT",
    "INT8": "TINYINT",
    "UTINYINT": "TINYINT",
    "USMALLINT": "INT",
    "UINTEGER": "BIGINT",
    "UBIGINT": "DECIMAL(20,0)",
    "DOUBLE": "FLOAT",
    "FLOAT": "REAL",
    "REAL": "REAL",
    "BOOLEAN": "BIT",
    "BOOL": "BIT",
    "DATE": "DATE",
    "TIMESTAMP": "DATETIME2",
    "DATETIME": "DATETIME2",
    "TIMESTAMP_S": "DATETIME2",
    "TIMESTAMP_MS": "DATETIME2",
    "TIMESTAMP_NS": "DATETIME2",
    "TIMESTAMPTZ": "DATETIMEOFFSET",
    "TIME": "TIME",
    "BLOB": "VARBINARY(MAX)",
    "BYTEA": "VARBINARY(MAX)",
    "UUID": "UNIQUEIDENTIFIER",
}


def _map_duckdb_type(duckdb_type: str) -> str:
    """Convert a DuckDB column type to a SQL Server column type."""
    t = (duckdb_type or "").strip().upper()
    if not t:
        return "NVARCHAR(MAX)"
    if t.startswith("DECIMAL") or t.startswith("NUMERIC"):
        return t.replace("NUMERIC", "DECIMAL")
    return _TYPE_MAP.get(t, "NVARCHAR(MAX)")


def _quote_ident(name: str) -> str:
    """Quote a SQL Server identifier with brackets, escaping any embedded `]`."""
    return "[" + str(name).replace("]", "]]") + "]"


def _qualified(schema: str, table: str) -> str:
    return f"{_quote_ident(schema)}.{_quote_ident(table)}"


# Auto-added lineage columns. Always created on `mode=create`; populated on
# every load if they're present on the destination table. Underscore prefix
# makes them unlikely to collide with real source columns.
LINEAGE_COLUMNS = [
    {"name": "_source_name", "type": "NVARCHAR(255)", "nullable": True},
    {"name": "_loaded_at",   "type": "DATETIME2",     "nullable": True},
]
LINEAGE_NAMES = [c["name"] for c in LINEAGE_COLUMNS]


def _existing_lineage_columns(cursor, schema: str, table: str) -> list[str]:
    """Return the lineage column names that actually exist on the destination table."""
    cursor.execute(
        """SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?""",
        (schema, table),
    )
    actual = {row[0] for row in cursor.fetchall()}
    return [n for n in LINEAGE_NAMES if n in actual]


def _get_connection_or_404(conn_id: str):
    store = current_app.config["METADATA_STORE"]
    conn_cfg = store.get_connection(conn_id)
    if not conn_cfg:
        return None, (jsonify({"error": "Connection not found"}), 404)
    return conn_cfg, None


@local_etl_bp.route("/connections", methods=["GET"])
def list_pipeline_connections():
    """List SQL Server connections available as ETL destinations."""
    store = current_app.config["METADATA_STORE"]
    conns = store.get_all_connections()
    # Return only fields the wizard needs; never expose passwords.
    return jsonify({
        "data": [
            {
                "id": c["id"],
                "name": c["name"],
                "server": c["server"],
                "database": c["database"],
                "active": c.get("active", True),
            }
            for c in conns
        ]
    }), 200


@local_etl_bp.route("/connections/<conn_id>/tables", methods=["GET"])
def list_destination_tables(conn_id: str):
    """List tables on the destination connection (schema + name)."""
    conn_cfg, err = _get_connection_or_404(conn_id)
    if err or conn_cfg is None:
        return err
    try:
        with DBConnector(conn_cfg) as db:
            rows = db.execute_query_dict(
                """SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name
                   FROM INFORMATION_SCHEMA.TABLES
                   WHERE TABLE_TYPE = 'BASE TABLE'
                   ORDER BY TABLE_SCHEMA, TABLE_NAME"""
            )
    except Exception as exc:
        return jsonify({"error": f"Failed to list tables: {exc}"}), 400
    tables = [{"schema": r["schema_name"], "name": r["table_name"]} for r in rows]
    return jsonify({"data": {"tables": tables}}), 200


@local_etl_bp.route("/connections/<conn_id>/inspect-table", methods=["POST"])
def inspect_destination_table(conn_id: str):
    """Check whether a target table exists; if so, return its columns."""
    conn_cfg, err = _get_connection_or_404(conn_id)
    if err or conn_cfg is None:
        return err

    body = request.get_json(silent=True) or {}
    schema = (body.get("schema") or "dbo").strip()
    table = (body.get("table") or "").strip()
    if not table:
        return jsonify({"error": "table is required"}), 400

    try:
        with DBConnector(conn_cfg) as db:
            cols = db.execute_query_dict(
                """SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE,
                          CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
                   FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                   ORDER BY ORDINAL_POSITION""",
                (schema, table),
            )
    except Exception as exc:
        return jsonify({"error": f"Failed to inspect table: {exc}"}), 400

    if not cols:
        return jsonify({"data": {"exists": False, "schema": schema, "table": table}}), 200

    columns = [
        {
            "name": c["COLUMN_NAME"],
            "type": c["DATA_TYPE"],
            "nullable": c["IS_NULLABLE"] == "YES",
            "max_length": c.get("CHARACTER_MAXIMUM_LENGTH"),
            "precision": c.get("NUMERIC_PRECISION"),
            "scale": c.get("NUMERIC_SCALE"),
        }
        for c in cols
    ]
    return jsonify({
        "data": {"exists": True, "schema": schema, "table": table, "columns": columns}
    }), 200


@local_etl_bp.route("/source-schema/<filename>", methods=["GET"])
def source_schema_with_mapping(filename: str):
    """
    Return a file's columns plus a suggested SQL Server type for each.
    Used by the wizard to pre-fill the CREATE TABLE step.
    """
    if "/" in filename or "\\" in filename:
        return jsonify({"error": "Invalid filename"}), 400

    safe_name = secure_filename(filename)
    storage = _resolve_storage_path()
    filepath = os.path.join(storage, safe_name)
    if not os.path.isfile(filepath):
        return jsonify({"error": "File not found"}), 404

    try:
        cols = describe_file(filepath)
    except Exception as exc:
        return jsonify({"error": f"Failed to read schema: {exc}"}), 400

    columns = [
        {
            "name": c["column_name"],
            "duckdb_type": c["column_type"],
            "sql_type": _map_duckdb_type(c["column_type"]),
            "nullable": True,
        }
        for c in cols
    ]
    return jsonify({"data": {"filename": safe_name, "columns": columns}}), 200


def _execute_load(conn_cfg, source_path, mode, schema, table, columns, upsert_keys):
    """
    Run the actual load. Returns (rows_loaded, duration_ms).
    Raises on any failure; the caller turns that into a 4xx/5xx response.

    Lineage columns (`_source_name`, `_loaded_at`) are auto-added to the CREATE
    DDL and populated on every load if the destination table has them.
    """
    file_data = read_file_rows(source_path)
    file_columns = file_data["columns"]
    file_rows = file_data["rows"]

    # The wizard always sends the full destination column list. Reorder source
    # rows so each value lines up with the destination column of the same name.
    col_indices = []
    for col in columns:
        try:
            col_indices.append(file_columns.index(col["name"]))
        except ValueError as exc:
            raise ValueError(
                f"Source file is missing column '{col['name']}' required by destination"
            ) from exc
    reordered = [[row[i] for i in col_indices] for row in file_rows]

    # Lineage values are the same for every row in this load.
    source_name = os.path.basename(source_path)
    loaded_at = datetime.utcnow()

    quoted_table = _qualified(schema, table)

    started = time.monotonic()
    with DBConnector(conn_cfg) as db:
        conn = db.connect()
        cursor = conn.cursor()
        cursor.fast_executemany = True

        if mode == "create":
            # Always include lineage columns when creating fresh.
            full_columns = list(columns) + LINEAGE_COLUMNS
            col_defs = ", ".join(
                f"{_quote_ident(c['name'])} {c['type']} "
                f"{'NULL' if c.get('nullable', True) else 'NOT NULL'}"
                for c in full_columns
            )
            cursor.execute(f"CREATE TABLE {quoted_table} ({col_defs})")
            conn.commit()
            present_lineage = list(LINEAGE_NAMES)
        else:
            # Existing table — only populate lineage columns it actually has.
            present_lineage = _existing_lineage_columns(cursor, schema, table)

        # Append lineage values to each row in the order they're declared.
        lineage_value_for = {
            "_source_name": source_name,
            "_loaded_at": loaded_at,
        }
        extra_values = [lineage_value_for[name] for name in present_lineage]
        rows_to_load = [row + extra_values for row in reordered]

        all_col_names = [c["name"] for c in columns] + present_lineage
        quoted_cols = ", ".join(_quote_ident(c) for c in all_col_names)
        placeholders = ", ".join(["?"] * len(all_col_names))

        if mode == "truncate_insert":
            cursor.execute(f"TRUNCATE TABLE {quoted_table}")
            conn.commit()

        if mode in ("create", "truncate_insert"):
            insert_sql = (
                f"INSERT INTO {quoted_table} ({quoted_cols}) VALUES ({placeholders})"
            )
            if rows_to_load:
                cursor.executemany(insert_sql, rows_to_load)
            conn.commit()

        elif mode == "upsert":
            if not upsert_keys:
                raise ValueError("upsert_keys is required for upsert mode")
            for key in upsert_keys:
                if key not in [c["name"] for c in columns]:
                    raise ValueError(f"upsert key '{key}' not in destination columns")

            # Staging table mirrors destination columns (user + lineage).
            staging_columns = list(columns) + [
                c for c in LINEAGE_COLUMNS if c["name"] in present_lineage
            ]
            staging = f"#stg_{uuid.uuid4().hex[:12]}"
            stg_defs = ", ".join(
                f"{_quote_ident(c['name'])} {c['type']}" for c in staging_columns
            )
            cursor.execute(f"CREATE TABLE {staging} ({stg_defs})")
            stg_insert = f"INSERT INTO {staging} ({quoted_cols}) VALUES ({placeholders})"
            if rows_to_load:
                cursor.executemany(stg_insert, rows_to_load)

            on_clause = " AND ".join(
                f"target.{_quote_ident(k)} = source.{_quote_ident(k)}"
                for k in upsert_keys
            )
            # Update everything except the keys, including lineage cols so we
            # can see when a row was last refreshed and which file refreshed it.
            non_key_cols = [c for c in all_col_names if c not in upsert_keys]
            update_clause = ""
            if non_key_cols:
                update_set = ", ".join(
                    f"target.{_quote_ident(c)} = source.{_quote_ident(c)}"
                    for c in non_key_cols
                )
                update_clause = f"WHEN MATCHED THEN UPDATE SET {update_set}"
            insert_vals = ", ".join(f"source.{_quote_ident(c)}" for c in all_col_names)
            merge_sql = (
                f"MERGE {quoted_table} AS target "
                f"USING {staging} AS source ON {on_clause} "
                f"{update_clause} "
                f"WHEN NOT MATCHED THEN INSERT ({quoted_cols}) VALUES ({insert_vals});"
            )
            cursor.execute(merge_sql)
            conn.commit()

        cursor.close()

    return len(reordered), round((time.monotonic() - started) * 1000, 1)


def _run_and_record(
    *, store, source_file, connection_id, schema, table, mode, columns,
    upsert_keys, pipeline_id=None, pipeline_name=None,
):
    """
    Validate inputs, execute the load, and record the run in history.
    Returns (response_body, http_status).

    Always inserts a row into etl_pipeline_runs — success or failure — so
    the user can see what happened on the Execution History view.
    """
    if not source_file:
        return {"error": "source_file is required"}, 400
    if not connection_id:
        return {"error": "connection_id is required"}, 400
    if not table:
        return {"error": "table is required"}, 400
    if mode not in ("create", "truncate_insert", "upsert"):
        return {"error": "mode must be create, truncate_insert, or upsert"}, 400
    if not columns:
        return {"error": "columns is required"}, 400
    if "/" in source_file or "\\" in source_file:
        return {"error": "Invalid source_file"}, 400

    safe_source = secure_filename(source_file)
    storage = _resolve_storage_path()
    source_path = os.path.join(storage, safe_source)
    if not os.path.isfile(source_path):
        return {"error": "Source file not found"}, 404

    conn_cfg = store.get_connection(connection_id)
    if not conn_cfg:
        return {"error": "Connection not found"}, 404

    started_at = datetime.utcnow().isoformat()
    destination = f"{schema}.{table}"
    try:
        rows_loaded, duration_ms = _execute_load(
            conn_cfg, source_path, mode, schema, table, columns, upsert_keys
        )
    except Exception as exc:
        store.record_pipeline_run({
            "pipeline_id": pipeline_id,
            "pipeline_name": pipeline_name,
            "source_file": safe_source,
            "connection_id": connection_id,
            "destination": destination,
            "mode": mode,
            "status": "error",
            "rows_loaded": 0,
            "duration_ms": 0,
            "started_at": started_at,
            "error_message": str(exc),
        })
        return {"error": f"Load failed: {exc}"}, 400

    run_id = store.record_pipeline_run({
        "pipeline_id": pipeline_id,
        "pipeline_name": pipeline_name,
        "source_file": safe_source,
        "connection_id": connection_id,
        "destination": destination,
        "mode": mode,
        "status": "success",
        "rows_loaded": rows_loaded,
        "duration_ms": duration_ms,
        "started_at": started_at,
    })
    return {
        "rows_loaded": rows_loaded,
        "duration_ms": duration_ms,
        "mode": mode,
        "destination": destination,
        "run_id": run_id,
        "started_at": started_at,
    }, 200


def _stamp_last_run(store, pipeline_id: str, status: str, rows_loaded: int):
    """Update last_run_* fields on a saved pipeline definition."""
    flow = store.get_flow(pipeline_id)
    if not flow:
        return
    flow["last_run_at"] = datetime.utcnow().isoformat()
    flow["last_run_status"] = status
    flow["last_run_rows"] = rows_loaded
    store.update_flow(pipeline_id, flow)


@local_etl_bp.route("/pipelines/run", methods=["POST"])
def run_pipeline():
    """
    Execute a file → SQL Server load (ad-hoc or saving as a new pipeline).
    Body: {
      source_file, connection_id, schema, table, mode,
      columns: [{name, type, nullable}],
      upsert_keys?: [str],
      save_as?: str  (optional pipeline name; saves a re-runnable definition)
    }
    """
    body = request.get_json(silent=True) or {}
    save_as = (body.get("save_as") or "").strip()

    store = current_app.config["METADATA_STORE"]
    result, status = _run_and_record(
        store=store,
        source_file=(body.get("source_file") or "").strip(),
        connection_id=(body.get("connection_id") or "").strip(),
        schema=(body.get("schema") or "dbo").strip(),
        table=(body.get("table") or "").strip(),
        mode=(body.get("mode") or "").strip(),
        columns=body.get("columns") or [],
        upsert_keys=body.get("upsert_keys") or [],
        pipeline_name=save_as or None,
    )
    if status != 200:
        return jsonify(result), status

    saved_id = None
    if save_as:
        source_file = body.get("source_file") or ""
        flow_def = {
            "name": save_as,
            "kind": "local_etl_pipeline",
            "source_kind": "flat_file",
            "source_file": source_file,
            # Save the file type so re-runs can target a different file
            # of the same kind (e.g. next week's customers.csv).
            "source_file_type": Path(source_file).suffix.lstrip(".").lower() or None,
            "connection_id": body.get("connection_id"),
            "schema": body.get("schema") or "dbo",
            "table": body.get("table"),
            "mode": body.get("mode"),
            "columns": body.get("columns"),
            "upsert_keys": body.get("upsert_keys") or [],
            "last_run_at": datetime.utcnow().isoformat(),
            "last_run_status": "success",
            "last_run_rows": result["rows_loaded"],
        }
        saved_id = store.create_flow(flow_def)

    return jsonify({
        "message": f"Loaded {result['rows_loaded']} rows into {result['destination']}",
        "data": {**result, "saved_pipeline_id": saved_id},
    }), 200


@local_etl_bp.route("/pipelines/<pipeline_id>/run", methods=["POST"])
def run_saved_pipeline(pipeline_id: str):
    """
    Re-execute a saved pipeline by id.

    Body (all optional): {
        "source_file": "different_file.csv"  # override saved source for this run only
    }
    The override must match the pipeline's saved source_file_type if one exists.
    The saved definition is also updated to remember the new source_file.
    """
    store = current_app.config["METADATA_STORE"]
    flow = store.get_flow(pipeline_id)
    if not flow or flow.get("kind") != "local_etl_pipeline":
        return jsonify({"error": "Pipeline not found"}), 404

    body = request.get_json(silent=True) or {}
    override_source = (body.get("source_file") or "").strip()
    saved_source = flow.get("source_file") or ""
    saved_type = (flow.get("source_file_type") or "").lower()

    source_file = override_source or saved_source
    if not source_file:
        return jsonify({"error": "No source file set on this pipeline. Pass source_file in the request body."}), 400

    if override_source and saved_type:
        override_ext = Path(override_source).suffix.lstrip(".").lower()
        if override_ext != saved_type:
            return jsonify({
                "error": f"source_file type mismatch: pipeline expects .{saved_type}, got .{override_ext}"
            }), 400

    result, status = _run_and_record(
        store=store,
        source_file=source_file,
        connection_id=flow.get("connection_id") or "",
        schema=flow.get("schema") or "dbo",
        table=flow.get("table") or "",
        mode=flow.get("mode") or "",
        columns=flow.get("columns") or [],
        upsert_keys=flow.get("upsert_keys") or [],
        pipeline_id=pipeline_id,
        pipeline_name=flow.get("name"),
    )
    if status != 200:
        _stamp_last_run(store, pipeline_id, "error", 0)
        return jsonify(result), status

    # If user picked a different file, remember it as the new default source.
    if override_source and override_source != saved_source:
        flow["source_file"] = override_source
        store.update_flow(pipeline_id, flow)

    _stamp_last_run(store, pipeline_id, "success", int(result["rows_loaded"]))
    return jsonify({
        "message": f"Loaded {result['rows_loaded']} rows into {result['destination']}",
        "data": result,
    }), 200


@local_etl_bp.route("/pipelines", methods=["GET"])
def list_pipelines():
    """List saved local-ETL pipeline definitions."""
    store = current_app.config["METADATA_STORE"]
    flows = store.get_all_flows()
    pipelines = [f for f in flows if f.get("kind") == "local_etl_pipeline"]
    return jsonify({"data": {"pipelines": pipelines}}), 200


@local_etl_bp.route("/pipelines", methods=["POST"])
def create_pipeline():
    """
    Save a pipeline definition without executing it.
    Body: same shape as /pipelines/run but `name` is required (replaces save_as).
    """
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    mode = (body.get("mode") or "").strip()
    if mode not in ("create", "truncate_insert", "upsert"):
        return jsonify({"error": "mode must be create, truncate_insert, or upsert"}), 400

    columns = body.get("columns") or []
    if not columns:
        return jsonify({"error": "columns is required"}), 400

    source_file = (body.get("source_file") or "").strip()
    flow_def = {
        "name": name,
        "kind": "local_etl_pipeline",
        "source_kind": "flat_file",
        "source_file": source_file,
        "source_file_type": Path(source_file).suffix.lstrip(".").lower() or None,
        "connection_id": (body.get("connection_id") or "").strip(),
        "schema": (body.get("schema") or "dbo").strip(),
        "table": (body.get("table") or "").strip(),
        "mode": mode,
        "columns": columns,
        "upsert_keys": body.get("upsert_keys") or [],
    }
    store = current_app.config["METADATA_STORE"]
    pipeline_id = store.create_flow(flow_def)
    return jsonify({"message": "Pipeline saved", "data": {"id": pipeline_id}}), 201


@local_etl_bp.route("/pipelines/<pipeline_id>", methods=["PUT"])
def update_pipeline(pipeline_id: str):
    """
    Update a saved pipeline definition (without running it).
    Body: same shape as /pipelines/run minus save_as. last_run_* fields
    are preserved from the existing record.
    """
    store = current_app.config["METADATA_STORE"]
    existing = store.get_flow(pipeline_id)
    if not existing or existing.get("kind") != "local_etl_pipeline":
        return jsonify({"error": "Pipeline not found"}), 404

    body = request.get_json(silent=True) or {}
    name = (body.get("name") or existing.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    mode = (body.get("mode") or "").strip()
    if mode not in ("create", "truncate_insert", "upsert"):
        return jsonify({"error": "mode must be create, truncate_insert, or upsert"}), 400

    columns = body.get("columns") or []
    if not columns:
        return jsonify({"error": "columns is required"}), 400

    source_file = (body.get("source_file") or "").strip()
    flow_def = {
        "name": name,
        "kind": "local_etl_pipeline",
        "source_kind": existing.get("source_kind", "flat_file"),
        "source_file": source_file,
        "source_file_type": Path(source_file).suffix.lstrip(".").lower() or None,
        "connection_id": (body.get("connection_id") or "").strip(),
        "schema": (body.get("schema") or "dbo").strip(),
        "table": (body.get("table") or "").strip(),
        "mode": mode,
        "columns": columns,
        "upsert_keys": body.get("upsert_keys") or [],
        # Preserve last-run metadata across edits.
        "last_run_at": existing.get("last_run_at"),
        "last_run_status": existing.get("last_run_status"),
        "last_run_rows": existing.get("last_run_rows"),
    }
    store.update_flow(pipeline_id, flow_def)
    return jsonify({"message": "Pipeline updated", "data": {"id": pipeline_id}}), 200


@local_etl_bp.route("/pipelines/<pipeline_id>", methods=["DELETE"])
def delete_pipeline(pipeline_id: str):
    """Delete a saved pipeline definition. Run history is preserved."""
    store = current_app.config["METADATA_STORE"]
    flow = store.get_flow(pipeline_id)
    if not flow or flow.get("kind") != "local_etl_pipeline":
        return jsonify({"error": "Pipeline not found"}), 404
    store.delete_flow(pipeline_id)
    return jsonify({"message": "Pipeline deleted"}), 200


@local_etl_bp.route("/pipeline-runs", methods=["GET"])
def list_pipeline_runs():
    """Return recent pipeline runs, newest first. Optional ?pipeline_id=... filter."""
    store = current_app.config["METADATA_STORE"]
    pipeline_id = request.args.get("pipeline_id")
    try:
        limit = int(request.args.get("limit", 50))
    except ValueError:
        limit = 50
    runs = store.get_pipeline_runs(limit=limit, pipeline_id=pipeline_id)
    # Normalize datetimes to ISO strings for JSON.
    for r in runs:
        if isinstance(r.get("started_at"), datetime):
            r["started_at"] = r["started_at"].isoformat()
    return jsonify({"data": {"runs": runs}}), 200
