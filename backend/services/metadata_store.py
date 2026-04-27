"""
Metadata Store
Persists all app metadata (connections, results, configs, flows, etc.) in SQL Server.
Replaces file-based storage (JSON/YAML) with a centralized database.
"""
import os
import json
import uuid
import threading
import pyodbc
from datetime import datetime
from typing import Dict, List, Optional


class MetadataStore:
    """SQL Server-backed metadata store for all application data."""

    def __init__(self, config: Optional[Dict] = None):
        """
        Args:
            config: Optional dict with keys host, port, user, password, database.
                   When None, falls back to MS3DM_METADATA_* env vars (legacy
                   dev/Docker workflow). The desktop bundle always passes config
                   loaded from the user's config.json.
        """
        cfg = config or {}
        self.host = cfg.get('host') or os.getenv('MS3DM_METADATA_HOST', 'sqlserver')
        self.port = int(cfg.get('port') or os.getenv('MS3DM_METADATA_PORT', '1433'))
        self.user = cfg.get('user') or os.getenv('MS3DM_METADATA_USER', 'sa')
        self.password = cfg.get('password') or os.getenv('MS3DM_METADATA_PASSWORD', '')
        # Late import to avoid a circular dependency at module-load time.
        from services.app_config import DEFAULT_DATABASE_NAME
        self.database = cfg.get('database') or os.getenv('MS3DM_METADATA_DATABASE', DEFAULT_DATABASE_NAME)
        self._local = threading.local()

    # ------------------------------------------------------------------ #
    #  Connection helpers
    # ------------------------------------------------------------------ #

    def _conn_str(self, database: str = None) -> str:
        db = database or self.database
        # Encrypt=Optional + TrustServerCertificate=yes lets internal SQL
        # Servers with self-signed certs connect under ODBC Driver 18's
        # stricter `Encrypt=Mandatory` default. See db_connector.py for the
        # same fix on user-supplied connections.
        # Wrap UID/PWD in braces so passwords containing ;, =, {, or quotes
        # (common in service-account creds) survive ODBC parsing.
        uid = "{" + str(self.user).replace("}", "}}") + "}"
        pwd = "{" + str(self.password).replace("}", "}}") + "}"
        return (
            "DRIVER={ODBC Driver 18 for SQL Server};"
            f"SERVER={self.host},{self.port};"
            f"DATABASE={db};"
            f"UID={uid};"
            f"PWD={pwd};"
            "Encrypt=Optional;"
            "TrustServerCertificate=yes;"
        )

    def _get_connection(self) -> pyodbc.Connection:
        conn = getattr(self._local, 'connection', None)
        if conn is not None:
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                cursor.close()
                return conn
            except Exception:
                pass

        conn = pyodbc.connect(self._conn_str(), timeout=10)
        conn.autocommit = False
        self._local.connection = conn
        return conn

    def _execute(self, sql: str, params: tuple = (), *, commit: bool = False):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(sql, params)
        if commit:
            conn.commit()
        return cursor

    def _fetchall_dict(self, sql: str, params: tuple = ()) -> List[Dict]:
        cursor = self._execute(sql, params)
        columns = [col[0] for col in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        cursor.close()
        return rows

    def _fetchone_dict(self, sql: str, params: tuple = ()) -> Optional[Dict]:
        cursor = self._execute(sql, params)
        columns = [col[0] for col in cursor.description]
        row = cursor.fetchone()
        cursor.close()
        if row is None:
            return None
        return dict(zip(columns, row))

    # ------------------------------------------------------------------ #
    #  Initialization
    # ------------------------------------------------------------------ #

    def initialize(self):
        """Create database and tables if they don't exist."""
        # Connect to master to ensure the metadata database exists
        master_conn = pyodbc.connect(self._conn_str('master'), timeout=10)
        master_conn.autocommit = True
        cursor = master_conn.cursor()
        cursor.execute(
            f"IF DB_ID('{self.database}') IS NULL CREATE DATABASE [{self.database}]"
        )
        cursor.close()
        master_conn.close()

        # Now connect to the metadata database and create tables
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            IF OBJECT_ID('connections', 'U') IS NULL
            CREATE TABLE connections (
                id              NVARCHAR(100)   PRIMARY KEY,
                name            NVARCHAR(255)   NOT NULL,
                server          NVARCHAR(255)   NOT NULL,
                port            INT             DEFAULT 1433,
                database_name   NVARCHAR(255)   NOT NULL,
                auth_type       NVARCHAR(50)    NOT NULL,
                username        NVARCHAR(255)   NULL,
                password        NVARCHAR(255)   NULL,
                description     NVARCHAR(MAX)   NULL,
                active          BIT             DEFAULT 1,
                is_sample       BIT             DEFAULT 0,
                created_at      DATETIME2       DEFAULT GETUTCDATE(),
                updated_at      DATETIME2       DEFAULT GETUTCDATE()
            )
        """)

        cursor.execute("""
            IF OBJECT_ID('quality_results', 'U') IS NULL
            CREATE TABLE quality_results (
                check_id        NVARCHAR(100)   PRIMARY KEY,
                connection_id   NVARCHAR(100)   NULL,
                timestamp       NVARCHAR(100)   NULL,
                status          NVARCHAR(50)    NULL,
                error_message   NVARCHAR(MAX)   NULL,
                check_types     NVARCHAR(MAX)   NULL,
                tables_checked  NVARCHAR(MAX)   NULL,
                summary         NVARCHAR(MAX)   NULL,
                details         NVARCHAR(MAX)   NULL
            )
        """)

        cursor.execute("""
            IF OBJECT_ID('quality_configs', 'U') IS NULL
            CREATE TABLE quality_configs (
                connection_id   NVARCHAR(100)   PRIMARY KEY,
                config_data     NVARCHAR(MAX)   NOT NULL,
                updated_at      DATETIME2       DEFAULT GETUTCDATE()
            )
        """)

        cursor.execute("""
            IF OBJECT_ID('expectation_results', 'U') IS NULL
            CREATE TABLE expectation_results (
                result_id       NVARCHAR(200)   PRIMARY KEY,
                suite_id        NVARCHAR(200)   NULL,
                suite_name      NVARCHAR(255)   NULL,
                connection_id   NVARCHAR(100)   NULL,
                execution_time  NVARCHAR(100)   NULL,
                duration_seconds FLOAT          NULL,
                status          NVARCHAR(50)    NULL,
                [statistics]    NVARCHAR(MAX)   NULL,
                results         NVARCHAR(MAX)   NULL
            )
        """)

        cursor.execute("""
            IF OBJECT_ID('catalog_metadata', 'U') IS NULL
            CREATE TABLE catalog_metadata (
                id              INT             IDENTITY(1,1) PRIMARY KEY,
                connection_id   NVARCHAR(100)   NOT NULL,
                schema_name     NVARCHAR(255)   NOT NULL,
                table_name      NVARCHAR(255)   NOT NULL,
                description     NVARCHAR(MAX)   NULL,
                owner           NVARCHAR(255)   NULL,
                tags            NVARCHAR(MAX)   NULL,
                column_metadata NVARCHAR(MAX)   NULL,
                updated_at      DATETIME2       DEFAULT GETUTCDATE(),
                CONSTRAINT uq_catalog UNIQUE (connection_id, schema_name, table_name)
            )
        """)

        cursor.execute("""
            IF OBJECT_ID('data_flows', 'U') IS NULL
            CREATE TABLE data_flows (
                flow_id         NVARCHAR(100)   PRIMARY KEY,
                name            NVARCHAR(255)   NULL,
                description     NVARCHAR(MAX)   NULL,
                owner           NVARCHAR(255)   NULL,
                schedule        NVARCHAR(255)   NULL,
                flow_data       NVARCHAR(MAX)   NULL,
                created_at      DATETIME2       DEFAULT GETUTCDATE(),
                updated_at      DATETIME2       DEFAULT GETUTCDATE()
            )
        """)

        cursor.execute("""
            IF OBJECT_ID('documents', 'U') IS NULL
            CREATE TABLE documents (
                doc_id          NVARCHAR(100)   PRIMARY KEY,
                title           NVARCHAR(255)   NOT NULL,
                category        NVARCHAR(255)   NULL DEFAULT 'General',
                content         NVARCHAR(MAX)   NULL,
                doc_type        NVARCHAR(50)    NULL DEFAULT 'note',
                tags            NVARCHAR(MAX)   NULL,
                created_at      DATETIME2       DEFAULT GETUTCDATE(),
                updated_at      DATETIME2       DEFAULT GETUTCDATE()
            )
        """)

        cursor.execute("""
            IF OBJECT_ID('app_settings', 'U') IS NULL
            CREATE TABLE app_settings (
                setting_key     NVARCHAR(255)   PRIMARY KEY,
                setting_value   NVARCHAR(MAX)   NULL,
                updated_at      DATETIME2       DEFAULT GETUTCDATE()
            )
        """)

        cursor.execute("""
            IF OBJECT_ID('etl_pipeline_runs', 'U') IS NULL
            CREATE TABLE etl_pipeline_runs (
                run_id          NVARCHAR(100)   PRIMARY KEY,
                pipeline_id     NVARCHAR(100)   NULL,
                pipeline_name   NVARCHAR(255)   NULL,
                source_file     NVARCHAR(255)   NULL,
                connection_id   NVARCHAR(100)   NULL,
                destination     NVARCHAR(500)   NULL,
                mode            NVARCHAR(50)    NULL,
                status          NVARCHAR(20)    NULL,
                rows_loaded     INT             NULL,
                duration_ms     FLOAT           NULL,
                started_at      DATETIME2       DEFAULT GETUTCDATE(),
                error_message   NVARCHAR(MAX)   NULL
            )
        """)

        conn.commit()
        cursor.close()

    # ================================================================== #
    #  CONNECTIONS  (replaces ConfigManager)
    # ================================================================== #

    def get_all_connections(self) -> List[Dict]:
        rows = self._fetchall_dict("SELECT * FROM connections ORDER BY name")
        return [self._row_to_connection(r) for r in rows]

    def get_connection(self, connection_id: str) -> Optional[Dict]:
        row = self._fetchone_dict(
            "SELECT * FROM connections WHERE id = ?", (connection_id,)
        )
        if row is None:
            return None
        return self._row_to_connection(row)

    def add_connection(self, data: Dict) -> str:
        required = ['name', 'server', 'database', 'auth_type']
        for f in required:
            if f not in data:
                raise ValueError(f"Missing required field: {f}")

        if data['auth_type'] not in ('windows', 'sql_auth'):
            raise ValueError("auth_type must be 'windows' or 'sql_auth'")

        if data['auth_type'] == 'sql_auth':
            if 'username' not in data or 'password' not in data:
                raise ValueError("username and password required for sql_auth")

        conn_id = data.get('id', str(uuid.uuid4()))

        # Check duplicate
        existing = self._fetchone_dict(
            "SELECT id FROM connections WHERE id = ?", (conn_id,)
        )
        if existing:
            raise ValueError(f"Connection with ID {conn_id} already exists")

        now = datetime.utcnow().isoformat()
        self._execute(
            """INSERT INTO connections
               (id, name, server, port, database_name, auth_type,
                username, password, description, active, is_sample,
                created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                conn_id,
                data['name'],
                data['server'],
                data.get('port', 1433),
                data['database'],
                data['auth_type'],
                data.get('username'),
                data.get('password'),
                data.get('description'),
                1 if data.get('active', True) else 0,
                1 if data.get('is_sample', False) else 0,
                now, now,
            ),
            commit=True,
        )
        return conn_id

    def update_connection(self, connection_id: str, data: Dict):
        existing = self.get_connection(connection_id)
        if not existing:
            raise ValueError(f"Connection with ID {connection_id} not found")

        # Preserve the existing password unless the update payload supplies a
        # new non-empty one. Important: the GET endpoints strip passwords from
        # responses, so edit forms will submit empty/missing — without this
        # guard, every edit would wipe the saved credential.
        new_password = data.get('password')
        password = new_password if new_password else existing.get('password')

        now = datetime.utcnow().isoformat()
        self._execute(
            """UPDATE connections SET
                name=?, server=?, port=?, database_name=?, auth_type=?,
                username=?, password=?, description=?, active=?, is_sample=?,
                updated_at=?
               WHERE id=?""",
            (
                data.get('name', existing['name']),
                data.get('server', existing['server']),
                data.get('port', existing.get('port', 1433)),
                data.get('database', existing['database']),
                data.get('auth_type', existing['auth_type']),
                data.get('username', existing.get('username')),
                password,
                data.get('description', existing.get('description')),
                1 if data.get('active', existing.get('active', True)) else 0,
                1 if data.get('is_sample', existing.get('is_sample', False)) else 0,
                now,
                connection_id,
            ),
            commit=True,
        )

    def delete_connection(self, connection_id: str):
        existing = self._fetchone_dict(
            "SELECT id FROM connections WHERE id = ?", (connection_id,)
        )
        if not existing:
            raise ValueError(f"Connection with ID {connection_id} not found")
        self._execute(
            "DELETE FROM connections WHERE id = ?", (connection_id,), commit=True
        )

    @staticmethod
    def _row_to_connection(row: Dict) -> Dict:
        """Convert a DB row to the dict shape the rest of the app expects."""
        return {
            'id': row['id'],
            'name': row['name'],
            'server': row['server'],
            'port': row.get('port', 1433),
            'database': row['database_name'],
            'auth_type': row['auth_type'],
            'username': row.get('username'),
            'password': row.get('password'),
            'description': row.get('description'),
            'active': bool(row.get('active', True)),
            'is_sample': bool(row.get('is_sample', False)),
        }

    # ================================================================== #
    #  QUALITY RESULTS
    # ================================================================== #

    def save_quality_result(self, result: Dict):
        check_id = result['check_id']
        self._execute(
            """MERGE quality_results AS target
               USING (SELECT ? AS check_id) AS source ON target.check_id = source.check_id
               WHEN MATCHED THEN UPDATE SET
                   connection_id=?, timestamp=?, status=?, error_message=?,
                   check_types=?, tables_checked=?, summary=?, details=?
               WHEN NOT MATCHED THEN INSERT
                   (check_id, connection_id, timestamp, status, error_message,
                    check_types, tables_checked, summary, details)
                   VALUES (?,?,?,?,?,?,?,?,?);""",
            (
                check_id,
                # UPDATE values
                result.get('connection_id'),
                result.get('timestamp'),
                result.get('status'),
                result.get('error_message'),
                json.dumps(result.get('check_types')),
                json.dumps(result.get('tables_checked')),
                json.dumps(result.get('summary')),
                json.dumps(result.get('details')),
                # INSERT values
                check_id,
                result.get('connection_id'),
                result.get('timestamp'),
                result.get('status'),
                result.get('error_message'),
                json.dumps(result.get('check_types')),
                json.dumps(result.get('tables_checked')),
                json.dumps(result.get('summary')),
                json.dumps(result.get('details')),
            ),
            commit=True,
        )

    def get_quality_result(self, check_id: str) -> Optional[Dict]:
        row = self._fetchone_dict(
            "SELECT * FROM quality_results WHERE check_id = ?", (check_id,)
        )
        if row is None:
            return None
        return self._deserialize_quality_result(row)

    def get_quality_history(self) -> List[Dict]:
        rows = self._fetchall_dict(
            "SELECT check_id, connection_id, timestamp, summary FROM quality_results ORDER BY timestamp DESC"
        )
        results = []
        for r in rows:
            results.append({
                'check_id': r['check_id'],
                'connection_id': r['connection_id'],
                'timestamp': r['timestamp'],
                'summary': json.loads(r['summary']) if r['summary'] else {},
            })
        return results

    @staticmethod
    def _deserialize_quality_result(row: Dict) -> Dict:
        result = dict(row)
        for field in ('check_types', 'tables_checked', 'summary', 'details'):
            if result.get(field):
                try:
                    result[field] = json.loads(result[field])
                except (json.JSONDecodeError, TypeError):
                    pass
        return result

    # ================================================================== #
    #  QUALITY CONFIGS
    # ================================================================== #

    def save_quality_config(self, connection_id: str, config_data: Dict):
        self._execute(
            """MERGE quality_configs AS target
               USING (SELECT ? AS connection_id) AS source
               ON target.connection_id = source.connection_id
               WHEN MATCHED THEN UPDATE SET config_data=?, updated_at=GETUTCDATE()
               WHEN NOT MATCHED THEN INSERT (connection_id, config_data) VALUES (?,?);""",
            (
                connection_id,
                json.dumps(config_data),
                connection_id,
                json.dumps(config_data),
            ),
            commit=True,
        )

    def get_quality_config(self, connection_id: str) -> Optional[Dict]:
        row = self._fetchone_dict(
            "SELECT config_data FROM quality_configs WHERE connection_id = ?",
            (connection_id,),
        )
        if row is None:
            return None
        try:
            return json.loads(row['config_data'])
        except (json.JSONDecodeError, TypeError):
            return None

    # ================================================================== #
    #  EXPECTATION RESULTS
    # ================================================================== #

    def save_expectation_result(self, result: Dict):
        result_id = result['result_id']
        self._execute(
            """MERGE expectation_results AS target
               USING (SELECT ? AS result_id) AS source ON target.result_id = source.result_id
               WHEN MATCHED THEN UPDATE SET
                   suite_id=?, suite_name=?, connection_id=?, execution_time=?,
                   duration_seconds=?, status=?, [statistics]=?, results=?
               WHEN NOT MATCHED THEN INSERT
                   (result_id, suite_id, suite_name, connection_id, execution_time,
                    duration_seconds, status, [statistics], results)
                   VALUES (?,?,?,?,?,?,?,?,?);""",
            (
                result_id,
                # UPDATE
                result.get('suite_id'),
                result.get('suite_name'),
                result.get('connection_id'),
                result.get('execution_time'),
                result.get('duration_seconds'),
                result.get('status'),
                json.dumps(result.get('statistics')),
                json.dumps(result.get('results')),
                # INSERT
                result_id,
                result.get('suite_id'),
                result.get('suite_name'),
                result.get('connection_id'),
                result.get('execution_time'),
                result.get('duration_seconds'),
                result.get('status'),
                json.dumps(result.get('statistics')),
                json.dumps(result.get('results')),
            ),
            commit=True,
        )

    def get_expectation_result(self, result_id: str) -> Optional[Dict]:
        row = self._fetchone_dict(
            "SELECT * FROM expectation_results WHERE result_id = ?", (result_id,)
        )
        if row is None:
            return None
        return self._deserialize_expectation_result(row)

    def get_expectation_history(self) -> List[Dict]:
        rows = self._fetchall_dict(
            """SELECT result_id, suite_name, execution_time,
                      duration_seconds, status, [statistics]
               FROM expectation_results ORDER BY execution_time DESC"""
        )
        results = []
        for r in rows:
            results.append({
                'result_id': r['result_id'],
                'suite_name': r['suite_name'],
                'execution_time': r['execution_time'],
                'duration_seconds': r['duration_seconds'],
                'status': r['status'],
                'statistics': json.loads(r['statistics']) if r['statistics'] else {},
            })
        return results

    @staticmethod
    def _deserialize_expectation_result(row: Dict) -> Dict:
        result = dict(row)
        for field in ('statistics', 'results'):
            if result.get(field):
                try:
                    result[field] = json.loads(result[field])
                except (json.JSONDecodeError, TypeError):
                    pass
        return result

    # ================================================================== #
    #  CATALOG METADATA
    # ================================================================== #

    def get_catalog_metadata(self, connection_id: str, schema: str, table: str) -> Optional[Dict]:
        row = self._fetchone_dict(
            """SELECT description, owner, tags, column_metadata
               FROM catalog_metadata
               WHERE connection_id=? AND schema_name=? AND table_name=?""",
            (connection_id, schema, table),
        )
        if row is None:
            return None
        result = dict(row)
        for field in ('tags', 'column_metadata'):
            if result.get(field):
                try:
                    result[field] = json.loads(result[field])
                except (json.JSONDecodeError, TypeError):
                    pass
        # Map column_metadata back to the 'columns' key the app expects
        if 'column_metadata' in result:
            result['columns'] = result.pop('column_metadata')
        return result

    def save_catalog_metadata(self, connection_id: str, schema: str, table: str, metadata: Dict):
        tags = json.dumps(metadata.get('tags', []))
        columns = json.dumps(metadata.get('columns', {}))
        self._execute(
            """MERGE catalog_metadata AS target
               USING (SELECT ? AS connection_id, ? AS schema_name, ? AS table_name) AS source
               ON target.connection_id = source.connection_id
                  AND target.schema_name = source.schema_name
                  AND target.table_name = source.table_name
               WHEN MATCHED THEN UPDATE SET
                   description=?, owner=?, tags=?, column_metadata=?, updated_at=GETUTCDATE()
               WHEN NOT MATCHED THEN INSERT
                   (connection_id, schema_name, table_name, description, owner, tags, column_metadata)
                   VALUES (?,?,?,?,?,?,?);""",
            (
                connection_id, schema, table,
                # UPDATE
                metadata.get('description', ''),
                metadata.get('owner', ''),
                tags,
                columns,
                # INSERT
                connection_id, schema, table,
                metadata.get('description', ''),
                metadata.get('owner', ''),
                tags,
                columns,
            ),
            commit=True,
        )

    # ================================================================== #
    #  DATA FLOWS
    # ================================================================== #

    def get_all_flows(self) -> List[Dict]:
        rows = self._fetchall_dict("SELECT * FROM data_flows ORDER BY name")
        return [self._deserialize_flow(r) for r in rows]

    def get_flow(self, flow_id: str) -> Optional[Dict]:
        row = self._fetchone_dict(
            "SELECT * FROM data_flows WHERE flow_id = ?", (flow_id,)
        )
        if row is None:
            return None
        return self._deserialize_flow(row)

    def create_flow(self, flow_data: Dict) -> str:
        flow_id = flow_data.get('id', str(uuid.uuid4()))
        now = datetime.utcnow().isoformat()
        self._execute(
            """INSERT INTO data_flows
               (flow_id, name, description, owner, schedule, flow_data, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                flow_id,
                flow_data.get('name'),
                flow_data.get('description'),
                flow_data.get('owner'),
                flow_data.get('schedule'),
                json.dumps(flow_data),
                now, now,
            ),
            commit=True,
        )
        return flow_id

    def update_flow(self, flow_id: str, flow_data: Dict):
        now = datetime.utcnow().isoformat()
        self._execute(
            """UPDATE data_flows SET
                name=?, description=?, owner=?, schedule=?, flow_data=?, updated_at=?
               WHERE flow_id=?""",
            (
                flow_data.get('name'),
                flow_data.get('description'),
                flow_data.get('owner'),
                flow_data.get('schedule'),
                json.dumps(flow_data),
                now,
                flow_id,
            ),
            commit=True,
        )

    def delete_flow(self, flow_id: str):
        self._execute(
            "DELETE FROM data_flows WHERE flow_id = ?", (flow_id,), commit=True
        )

    @staticmethod
    def _deserialize_flow(row: Dict) -> Dict:
        if row.get('flow_data'):
            try:
                flow = json.loads(row['flow_data'])
                flow['id'] = row['flow_id']
                return flow
            except (json.JSONDecodeError, TypeError):
                pass
        return {'id': row['flow_id'], 'name': row.get('name')}

    # ================================================================== #
    #  DOCUMENTS
    # ================================================================== #

    def get_all_documents(self) -> List[Dict]:
        rows = self._fetchall_dict(
            """SELECT doc_id, title, category, doc_type, tags,
                      CAST(LEFT(content, 200) AS NVARCHAR(200)) AS preview,
                      created_at, updated_at
               FROM documents ORDER BY updated_at DESC"""
        )
        for r in rows:
            if r.get('tags'):
                try:
                    r['tags'] = json.loads(r['tags'])
                except (json.JSONDecodeError, TypeError):
                    r['tags'] = []
        return rows

    def get_document(self, doc_id: str) -> Optional[Dict]:
        row = self._fetchone_dict(
            "SELECT * FROM documents WHERE doc_id = ?", (doc_id,)
        )
        if row is None:
            return None
        if row.get('tags'):
            try:
                row['tags'] = json.loads(row['tags'])
            except (json.JSONDecodeError, TypeError):
                row['tags'] = []
        return row

    def create_document(self, data: Dict) -> str:
        doc_id = data.get('doc_id', str(uuid.uuid4()))
        now = datetime.utcnow().isoformat()
        self._execute(
            """INSERT INTO documents
               (doc_id, title, category, content, doc_type, tags, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                doc_id,
                data.get('title', 'Untitled'),
                data.get('category', 'General'),
                data.get('content', ''),
                data.get('doc_type', 'note'),
                json.dumps(data.get('tags', [])),
                now, now,
            ),
            commit=True,
        )
        return doc_id

    def update_document(self, doc_id: str, data: Dict):
        now = datetime.utcnow().isoformat()
        sets = ["updated_at=?"]
        params = [now]

        for field in ('title', 'category', 'content', 'doc_type'):
            if field in data:
                sets.append(f"{field}=?")
                params.append(data[field])
        if 'tags' in data:
            sets.append("tags=?")
            params.append(json.dumps(data['tags']))

        params.append(doc_id)
        self._execute(
            f"UPDATE documents SET {', '.join(sets)} WHERE doc_id=?",
            tuple(params),
            commit=True,
        )

    def delete_document(self, doc_id: str):
        self._execute(
            "DELETE FROM documents WHERE doc_id = ?", (doc_id,), commit=True
        )

    def get_documents_by_category(self, category: str) -> List[Dict]:
        rows = self._fetchall_dict(
            """SELECT doc_id, title, category, doc_type, tags,
                      CAST(LEFT(content, 200) AS NVARCHAR(200)) AS preview,
                      created_at, updated_at
               FROM documents WHERE category = ? ORDER BY updated_at DESC""",
            (category,),
        )
        for r in rows:
            if r.get('tags'):
                try:
                    r['tags'] = json.loads(r['tags'])
                except (json.JSONDecodeError, TypeError):
                    r['tags'] = []
        return rows

    def get_document_categories(self) -> List[str]:
        rows = self._fetchall_dict(
            "SELECT DISTINCT category FROM documents WHERE category IS NOT NULL ORDER BY category"
        )
        return [r['category'] for r in rows]

    # ================================================================== #
    #  APP SETTINGS  (key-value store)
    # ================================================================== #

    def get_setting(self, key: str) -> Optional[str]:
        row = self._fetchone_dict(
            "SELECT setting_value FROM app_settings WHERE setting_key = ?", (key,)
        )
        return row['setting_value'] if row else None

    def set_setting(self, key: str, value: str):
        self._execute(
            """MERGE app_settings AS target
               USING (SELECT ? AS setting_key) AS source
               ON target.setting_key = source.setting_key
               WHEN MATCHED THEN UPDATE SET setting_value=?, updated_at=GETUTCDATE()
               WHEN NOT MATCHED THEN INSERT (setting_key, setting_value) VALUES (?,?);""",
            (key, value, key, value),
            commit=True,
        )

    # ================================================================== #
    #  ETL PIPELINE RUNS  (execution history)
    # ================================================================== #

    def record_pipeline_run(self, run: Dict) -> str:
        """Insert a row into etl_pipeline_runs and return its run_id."""
        run_id = run.get('run_id', str(uuid.uuid4()))
        self._execute(
            """INSERT INTO etl_pipeline_runs
               (run_id, pipeline_id, pipeline_name, source_file, connection_id,
                destination, mode, status, rows_loaded, duration_ms,
                started_at, error_message)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                run_id,
                run.get('pipeline_id'),
                run.get('pipeline_name'),
                run.get('source_file'),
                run.get('connection_id'),
                run.get('destination'),
                run.get('mode'),
                run.get('status'),
                run.get('rows_loaded'),
                run.get('duration_ms'),
                run.get('started_at') or datetime.utcnow().isoformat(),
                run.get('error_message'),
            ),
            commit=True,
        )
        return run_id

    def get_pipeline_runs(self, limit: int = 50, pipeline_id: Optional[str] = None) -> List[Dict]:
        """Return recent pipeline runs, newest first. Optionally filter by pipeline_id."""
        limit = max(1, min(int(limit), 500))
        if pipeline_id:
            sql = (
                f"SELECT TOP {limit} * FROM etl_pipeline_runs "
                "WHERE pipeline_id = ? ORDER BY started_at DESC"
            )
            return self._fetchall_dict(sql, (pipeline_id,))
        sql = f"SELECT TOP {limit} * FROM etl_pipeline_runs ORDER BY started_at DESC"
        return self._fetchall_dict(sql)

    def get_last_cleanup(self) -> Optional[datetime]:
        val = self.get_setting('last_cleanup')
        if val:
            try:
                return datetime.fromisoformat(val)
            except Exception:
                pass
        return None

    def set_last_cleanup(self):
        self.set_setting('last_cleanup', datetime.now().isoformat())
