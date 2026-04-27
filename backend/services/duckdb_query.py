"""
DuckDB Query Service

Executes SQL against local flat files (CSV, Parquet, JSON, Excel) using DuckDB.
Each request gets a fresh in-memory connection with auto-registered views for every
file in the configured storage directory.
"""

import os
import time
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import duckdb

# Maps file extensions to DuckDB reader functions
_READER_MAP = {
    ".csv": "read_csv_auto('{path}')",
    ".parquet": "read_parquet('{path}')",
    ".json": "read_json_auto('{path}')",
    ".jsonl": "read_json_auto('{path}')",
    ".xlsx": "st_read('{path}')",
    ".xls": "st_read('{path}')",
}

SUPPORTED_EXTENSIONS = set(_READER_MAP.keys())

DEFAULT_ROW_LIMIT = 10_000


def _view_name(filename: str) -> str:
    """Derive a SQL-friendly view name from a filename."""
    stem = Path(filename).stem
    # Replace non-alphanumeric chars with underscores
    name = "".join(c if c.isalnum() or c == "_" else "_" for c in stem)
    # Ensure it doesn't start with a digit
    if name and name[0].isdigit():
        name = f"f_{name}"
    return name or "unnamed"


def _reader_sql(filepath: str, ext: str) -> str:
    """Return the DuckDB reader expression for a file."""
    template = _READER_MAP.get(ext)
    if not template:
        raise ValueError(f"Unsupported extension: {ext}")
    # Escape single quotes in path
    safe_path = filepath.replace("'", "''")
    return template.format(path=safe_path)


def _register_views(conn: duckdb.DuckDBPyConnection, storage_dir: str) -> dict[str, str]:
    """Scan storage_dir and CREATE VIEW for each supported file. Returns {view_name: filename}."""
    views = {}
    if not os.path.isdir(storage_dir):
        return views

    # Install and load spatial extension for Excel support
    has_excel = False
    for f in os.listdir(storage_dir):
        ext = Path(f).suffix.lower()
        if ext in (".xlsx", ".xls"):
            has_excel = True
            break

    if has_excel:
        try:
            conn.execute("INSTALL spatial; LOAD spatial;")
        except Exception:
            pass  # Extension may already be loaded or unavailable

    for filename in sorted(os.listdir(storage_dir)):
        ext = Path(filename).suffix.lower()
        if ext not in _READER_MAP:
            continue
        filepath = os.path.join(storage_dir, filename)
        if not os.path.isfile(filepath):
            continue
        vname = _view_name(filename)
        # Deduplicate view names
        base = vname
        counter = 2
        while vname in views:
            vname = f"{base}_{counter}"
            counter += 1
        try:
            reader = _reader_sql(filepath, ext)
            conn.execute(f'CREATE VIEW "{vname}" AS SELECT * FROM {reader}')
            views[vname] = filename
        except Exception:
            pass  # Skip files that DuckDB can't read
    return views


def _serialize_value(val):
    """Convert DuckDB values to JSON-serializable types."""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, bytes):
        return val.hex()
    return val


def execute_query(
    sql: str,
    storage_dir: str,
    limit: int = DEFAULT_ROW_LIMIT,
) -> dict:
    """
    Execute a SQL query against files in storage_dir.

    Returns dict with keys: columns, rows, row_count, truncated, duration_ms, views
    """
    conn = duckdb.connect(":memory:")
    try:
        views = _register_views(conn, storage_dir)
        start = time.monotonic()
        result = conn.execute(sql)
        columns = [desc[0] for desc in result.description]
        all_rows = result.fetchmany(limit + 1)
        elapsed_ms = round((time.monotonic() - start) * 1000, 1)

        truncated = len(all_rows) > limit
        rows = all_rows[:limit]

        serialized = [[_serialize_value(v) for v in row] for row in rows]

        return {
            "columns": columns,
            "rows": serialized,
            "row_count": len(serialized),
            "truncated": truncated,
            "duration_ms": elapsed_ms,
            "views": views,
        }
    finally:
        conn.close()


def describe_file(filepath: str) -> list[dict]:
    """Return column names and types for a file using DuckDB DESCRIBE."""
    ext = Path(filepath).suffix.lower()
    if ext not in _READER_MAP:
        raise ValueError(f"Unsupported file type: {ext}")

    conn = duckdb.connect(":memory:")
    try:
        if ext in (".xlsx", ".xls"):
            try:
                conn.execute("INSTALL spatial; LOAD spatial;")
            except Exception:
                pass
        reader = _reader_sql(filepath, ext)
        result = conn.execute(f"DESCRIBE SELECT * FROM {reader}")
        return [
            {"column_name": row[0], "column_type": row[1]}
            for row in result.fetchall()
        ]
    finally:
        conn.close()


def read_file_rows(filepath: str, limit: int | None = None) -> dict:
    """
    Read all (or up to `limit`) rows from a file via DuckDB.
    Returns {"columns": [...], "types": [...], "rows": [...], "row_count": int}.
    Values are returned as native Python types (not serialized) so they can be
    passed to pyodbc executemany.
    """
    ext = Path(filepath).suffix.lower()
    if ext not in _READER_MAP:
        raise ValueError(f"Unsupported file type: {ext}")

    conn = duckdb.connect(":memory:")
    try:
        if ext in (".xlsx", ".xls"):
            try:
                conn.execute("INSTALL spatial; LOAD spatial;")
            except Exception:
                pass
        reader = _reader_sql(filepath, ext)
        sql = f"SELECT * FROM {reader}"
        if limit is not None:
            sql += f" LIMIT {int(limit)}"
        result = conn.execute(sql)
        columns = [desc[0] for desc in result.description]
        types = [str(desc[1]) for desc in result.description]
        rows = [list(row) for row in result.fetchall()]
        return {
            "columns": columns,
            "types": types,
            "rows": rows,
            "row_count": len(rows),
        }
    finally:
        conn.close()
