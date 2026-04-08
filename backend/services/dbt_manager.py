"""
dbt Manager
Handles dbt Core operations for documentation, lineage, and source freshness.
Each connection gets an isolated dbt project under dbt_project/targets/<connection_id>/.
"""
import json
import logging
import os
import shutil
import subprocess
import threading
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import yaml

from services.db_connector import DBConnector

logger = logging.getLogger(__name__)

# Base directory for all dbt project artifacts
DBT_PROJECT_BASE = Path(__file__).resolve().parent.parent / "dbt_project"
TARGETS_DIR = DBT_PROJECT_BASE / "targets"

# Per-connection locks to prevent concurrent dbt runs on the same connection
_connection_locks: Dict[str, threading.Lock] = defaultdict(threading.Lock)


class DbtManager:
    """Manages dbt operations for a single connection."""

    def __init__(self, connection_config: Dict, store=None):
        self.config = connection_config
        self.connection_id = connection_config["id"]
        self.store = store
        self.project_dir = TARGETS_DIR / self.connection_id
        self.lock = _connection_locks[self.connection_id]

    # ------------------------------------------------------------------ #
    #  Directory / file helpers
    # ------------------------------------------------------------------ #

    def _ensure_project_dir(self):
        """Create the per-connection dbt project directory structure."""
        models_dir = self.project_dir / "models"
        models_dir.mkdir(parents=True, exist_ok=True)
        (self.project_dir / "target").mkdir(exist_ok=True)

    def _write_dbt_project_yml(self):
        """Write dbt_project.yml for this connection."""
        project = {
            "name": f"ms3dm_{self.connection_id.replace('-', '_')}",
            "version": "1.0.0",
            "config-version": 2,
            "profile": "ms3dm",
            "model-paths": ["models"],
            "target-path": "target",
            "clean-targets": ["target"],
        }
        path = self.project_dir / "dbt_project.yml"
        path.write_text(yaml.dump(project, default_flow_style=False))

    def _write_profiles_yml(self):
        """Generate profiles.yml from the connection configuration."""
        auth_type = self.config.get("auth_type", "sql_auth")
        target_cfg = {
            "type": "sqlserver",
            "driver": "ODBC Driver 18 for SQL Server",
            "server": self.config["server"],
            "port": self.config.get("port", 1433),
            "database": self.config["database"],
            "schema": "dbo",
            "trust_cert": True,
            "threads": 1,
        }

        if auth_type == "windows":
            target_cfg["authentication"] = "windows"
        else:
            target_cfg["authentication"] = "sql"
            target_cfg["user"] = self.config.get("username", "sa")
            target_cfg["password"] = self.config.get("password", "")

        profiles = {
            "ms3dm": {
                "target": "default",
                "outputs": {
                    "default": target_cfg,
                },
            }
        }
        path = self.project_dir / "profiles.yml"
        path.write_text(yaml.dump(profiles, default_flow_style=False))

    # ------------------------------------------------------------------ #
    #  Schema discovery
    # ------------------------------------------------------------------ #

    def _discover_schema(self) -> Dict[str, Dict[str, List[Dict]]]:
        """
        Query INFORMATION_SCHEMA to discover all tables and columns.

        Returns:
            { schema_name: { table_name: [ {column, data_type}, ... ] } }
        """
        db = DBConnector(self.config)
        query = """
            SELECT
                c.TABLE_SCHEMA,
                c.TABLE_NAME,
                c.COLUMN_NAME,
                c.DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS c
            INNER JOIN INFORMATION_SCHEMA.TABLES t
                ON c.TABLE_SCHEMA = t.TABLE_SCHEMA
               AND c.TABLE_NAME = t.TABLE_NAME
            WHERE t.TABLE_TYPE = 'BASE TABLE'
              AND c.TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
            ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
        """
        rows = db.execute_query(query)

        schemas: Dict[str, Dict[str, List[Dict]]] = {}
        for row in rows:
            schema_name, table_name, column_name, data_type = row[0], row[1], row[2], row[3]
            schemas.setdefault(schema_name, {}).setdefault(table_name, []).append(
                {"name": column_name, "data_type": data_type}
            )
        return schemas

    def _load_catalog_descriptions(self) -> Dict[str, Dict]:
        """
        Load existing descriptions from catalog_metadata table.

        Returns:
            { "schema.table": { "description": ..., "columns": { col: { "description": ... } } } }
        """
        if not self.store:
            return {}

        descriptions = {}
        try:
            rows = self.store._fetchall_dict(
                "SELECT schema_name, table_name, description, column_metadata "
                "FROM catalog_metadata WHERE connection_id = ?",
                (self.connection_id,),
            )
            for row in rows:
                key = f"{row['schema_name']}.{row['table_name']}"
                col_meta = {}
                if row.get("column_metadata"):
                    try:
                        col_meta = json.loads(row["column_metadata"])
                    except (json.JSONDecodeError, TypeError):
                        pass
                descriptions[key] = {
                    "description": row.get("description", ""),
                    "columns": col_meta,
                }
        except Exception:
            logger.warning("Could not load catalog descriptions", exc_info=True)
        return descriptions

    # ------------------------------------------------------------------ #
    #  Public methods
    # ------------------------------------------------------------------ #

    def generate_sources(self) -> Dict:
        """
        Discover schema via INFORMATION_SCHEMA and write sources.yml.
        Merges descriptions from catalog_metadata.
        """
        with self.lock:
            self._ensure_project_dir()

            discovered = self._discover_schema()
            catalog_desc = self._load_catalog_descriptions()

            database_name = self.config["database"]
            source_tables = []

            for schema_name, tables in discovered.items():
                for table_name, columns in tables.items():
                    key = f"{schema_name}.{table_name}"
                    meta = catalog_desc.get(key, {})
                    table_desc = meta.get("description", "")
                    col_descs = meta.get("columns", {})

                    col_entries = []
                    for col in columns:
                        col_entry = {
                            "name": col["name"],
                            "description": col_descs.get(col["name"], {}).get("description", ""),
                            "data_type": col["data_type"],
                        }
                        col_entries.append(col_entry)

                    source_tables.append({
                        "name": table_name,
                        "description": table_desc,
                        "columns": col_entries,
                        "meta": {"schema": schema_name},
                    })

            sources_yaml = {
                "version": 2,
                "sources": [
                    {
                        "name": database_name,
                        "database": database_name,
                        "schema": "dbo",
                        "tables": source_tables,
                    }
                ],
            }

            path = self.project_dir / "models" / "sources.yml"
            path.write_text(yaml.dump(sources_yaml, default_flow_style=False, sort_keys=False))

            return {
                "success": True,
                "tables_discovered": len(source_tables),
                "schemas": list(discovered.keys()),
                "path": str(path),
            }

    def generate_docs(self) -> Dict:
        """
        Full pipeline: write profiles.yml, ensure sources.yml, run `dbt docs generate`.
        """
        with self.lock:
            self._ensure_project_dir()
            self._write_dbt_project_yml()
            self._write_profiles_yml()

            # Generate sources if they don't exist yet
            sources_path = self.project_dir / "models" / "sources.yml"
            if not sources_path.exists():
                self.generate_sources.__wrapped__(self) if hasattr(self.generate_sources, '__wrapped__') else self._generate_sources_unlocked()

            return self._run_dbt_command(["docs", "generate"])

    def _generate_sources_unlocked(self):
        """Generate sources without acquiring the lock (called when lock is already held)."""
        self._ensure_project_dir()
        discovered = self._discover_schema()
        catalog_desc = self._load_catalog_descriptions()

        database_name = self.config["database"]
        source_tables = []

        for schema_name, tables in discovered.items():
            for table_name, columns in tables.items():
                key = f"{schema_name}.{table_name}"
                meta = catalog_desc.get(key, {})
                table_desc = meta.get("description", "")
                col_descs = meta.get("columns", {})

                col_entries = []
                for col in columns:
                    col_entry = {
                        "name": col["name"],
                        "description": col_descs.get(col["name"], {}).get("description", ""),
                        "data_type": col["data_type"],
                    }
                    col_entries.append(col_entry)

                source_tables.append({
                    "name": table_name,
                    "description": table_desc,
                    "columns": col_entries,
                    "meta": {"schema": schema_name},
                })

        sources_yaml = {
            "version": 2,
            "sources": [
                {
                    "name": database_name,
                    "database": database_name,
                    "schema": "dbo",
                    "tables": source_tables,
                }
            ],
        }

        path = self.project_dir / "models" / "sources.yml"
        path.write_text(yaml.dump(sources_yaml, default_flow_style=False, sort_keys=False))

    def get_catalog(self) -> Optional[Dict]:
        """Return parsed catalog.json if it exists."""
        path = self.project_dir / "target" / "catalog.json"
        if not path.exists():
            return None
        return json.loads(path.read_text())

    def get_manifest(self) -> Optional[Dict]:
        """Return parsed manifest.json if it exists."""
        path = self.project_dir / "target" / "manifest.json"
        if not path.exists():
            return None
        return json.loads(path.read_text())

    def get_sources(self) -> Optional[Dict]:
        """Return generated sources.yml as parsed YAML."""
        path = self.project_dir / "models" / "sources.yml"
        if not path.exists():
            return None
        return yaml.safe_load(path.read_text())

    def get_lineage(self) -> Optional[Dict]:
        """Extract source nodes and relationships from manifest.json."""
        manifest = self.get_manifest()
        if not manifest:
            return None

        sources = []
        nodes = manifest.get("sources", {})
        for key, node in nodes.items():
            sources.append({
                "unique_id": node.get("unique_id"),
                "name": node.get("name"),
                "schema": node.get("schema"),
                "database": node.get("database"),
                "source_name": node.get("source_name"),
                "columns": {
                    col_name: {
                        "name": col_info.get("name"),
                        "description": col_info.get("description", ""),
                        "data_type": col_info.get("data_type", ""),
                    }
                    for col_name, col_info in node.get("columns", {}).items()
                },
                "description": node.get("description", ""),
            })

        return {
            "connection_id": self.connection_id,
            "sources": sources,
            "source_count": len(sources),
        }

    def get_status(self) -> Dict:
        """Return artifact existence, timestamps, and counts."""
        catalog_path = self.project_dir / "target" / "catalog.json"
        manifest_path = self.project_dir / "target" / "manifest.json"
        sources_path = self.project_dir / "models" / "sources.yml"

        def _file_info(p: Path) -> Optional[Dict]:
            if not p.exists():
                return None
            stat = p.stat()
            return {
                "exists": True,
                "size_bytes": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            }

        status = {
            "connection_id": self.connection_id,
            "has_artifacts": catalog_path.exists() and manifest_path.exists(),
            "catalog": _file_info(catalog_path),
            "manifest": _file_info(manifest_path),
            "sources": _file_info(sources_path),
        }

        # Add source count from sources.yml if available
        if sources_path.exists():
            try:
                sources_data = yaml.safe_load(sources_path.read_text())
                tables = sources_data.get("sources", [{}])[0].get("tables", [])
                status["table_count"] = len(tables)
            except Exception:
                status["table_count"] = 0

        return status

    def source_freshness(self) -> Dict:
        """Run `dbt source freshness`."""
        with self.lock:
            return self._run_dbt_command(["source", "freshness"])

    def cleanup(self) -> Dict:
        """Remove all generated artifacts for this connection."""
        with self.lock:
            if self.project_dir.exists():
                shutil.rmtree(self.project_dir)
                return {"success": True, "message": f"Cleaned up artifacts for {self.connection_id}"}
            return {"success": True, "message": "No artifacts to clean up"}

    # ------------------------------------------------------------------ #
    #  Internal: subprocess runner
    # ------------------------------------------------------------------ #

    def _run_dbt_command(self, args: List[str]) -> Dict:
        """
        Run a dbt CLI command as a subprocess.

        Args:
            args: dbt subcommand and flags, e.g. ["docs", "generate"]

        Returns:
            { success, stdout, stderr }
        """
        cmd = [
            "dbt",
            *args,
            "--project-dir", str(self.project_dir),
            "--profiles-dir", str(self.project_dir),
        ]

        logger.info("Running dbt command: %s", " ".join(cmd))

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5-minute timeout
                cwd=str(self.project_dir),
            )

            success = result.returncode == 0

            if not success:
                logger.error("dbt command failed: %s\nstderr: %s", " ".join(cmd), result.stderr)
            else:
                logger.info("dbt command succeeded: %s", " ".join(cmd))

            return {
                "success": success,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "return_code": result.returncode,
            }

        except subprocess.TimeoutExpired:
            logger.error("dbt command timed out: %s", " ".join(cmd))
            return {
                "success": False,
                "stdout": "",
                "stderr": "Command timed out after 5 minutes",
                "return_code": -1,
            }
        except FileNotFoundError:
            logger.error("dbt executable not found")
            return {
                "success": False,
                "stdout": "",
                "stderr": "dbt executable not found. Ensure dbt-core is installed.",
                "return_code": -1,
            }
