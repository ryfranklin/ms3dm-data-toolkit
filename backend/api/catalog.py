"""
Data Catalog API endpoints
Discover and document database assets
"""
from flask import Blueprint, request, jsonify, current_app
from services.db_connector import DBConnector

catalog_bp = Blueprint('catalog', __name__)


def _store():
    return current_app.config['METADATA_STORE']


@catalog_bp.route('/discover', methods=['POST'])
def discover_schema():
    """Discover all database objects (tables, views, columns)"""
    try:
        data = request.json
        connection_id = data.get('connection_id')

        if not connection_id:
            return jsonify({'error': 'connection_id is required'}), 400

        connection = _store().get_connection(connection_id)
        if not connection:
            return jsonify({'error': 'Connection not found'}), 404

        db = DBConnector(connection)

        # Get all schemas
        schemas_query = """
            SELECT DISTINCT schema_name
            FROM INFORMATION_SCHEMA.SCHEMATA
            WHERE schema_name NOT IN ('sys', 'INFORMATION_SCHEMA')
            ORDER BY schema_name
        """
        schemas = db.execute_query(schemas_query)

        catalog = {
            'connection_id': connection_id,
            'schemas': []
        }

        for schema_row in schemas:
            schema_name = schema_row[0]

            # Get tables and views for this schema
            objects_query = """
                SELECT
                    t.TABLE_SCHEMA,
                    t.TABLE_NAME,
                    t.TABLE_TYPE,
                    (SELECT COUNT(*)
                     FROM INFORMATION_SCHEMA.COLUMNS c
                     WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA
                     AND c.TABLE_NAME = t.TABLE_NAME) as column_count
                FROM INFORMATION_SCHEMA.TABLES t
                WHERE t.TABLE_SCHEMA = ?
                ORDER BY t.TABLE_TYPE, t.TABLE_NAME
            """
            objects = db.execute_query(objects_query, (schema_name,))

            schema_data = {
                'name': schema_name,
                'tables': [],
                'views': []
            }

            for obj_row in objects:
                obj_info = {
                    'schema': obj_row[0],
                    'name': obj_row[1],
                    'type': obj_row[2],
                    'column_count': obj_row[3]
                }

                if obj_row[2] == 'BASE TABLE':
                    schema_data['tables'].append(obj_info)
                elif obj_row[2] == 'VIEW':
                    schema_data['views'].append(obj_info)

            catalog['schemas'].append(schema_data)

        return jsonify(catalog), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@catalog_bp.route('/table/<schema>/<table>', methods=['GET'])
def get_table_details(schema, table):
    """Get detailed information about a specific table"""
    try:
        connection_id = request.args.get('connection_id')

        if not all([connection_id, schema, table]):
            return jsonify({'error': 'connection_id, schema, and table are required'}), 400

        connection = _store().get_connection(connection_id)
        if not connection:
            return jsonify({'error': 'Connection not found'}), 404

        db = DBConnector(connection)

        # Get columns with detailed info
        columns_query = """
            SELECT
                c.COLUMN_NAME,
                c.DATA_TYPE,
                c.CHARACTER_MAXIMUM_LENGTH,
                c.NUMERIC_PRECISION,
                c.NUMERIC_SCALE,
                c.IS_NULLABLE,
                c.COLUMN_DEFAULT,
                c.ORDINAL_POSITION,
                CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'YES' ELSE 'NO' END as IS_PRIMARY_KEY
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN (
                SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                    ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                    AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
                WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA
                AND c.TABLE_NAME = pk.TABLE_NAME
                AND c.COLUMN_NAME = pk.COLUMN_NAME
            WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
            ORDER BY c.ORDINAL_POSITION
        """
        columns = db.execute_query(columns_query, (schema, table))

        # Get row count
        try:
            count_query = f"SELECT COUNT(*) FROM [{schema}].[{table}]"
            row_count_result = db.execute_query(count_query)
            row_count = row_count_result[0][0] if row_count_result else 0
        except:
            row_count = None

        # Get foreign keys
        fk_query = """
            SELECT
                fk.name as FK_NAME,
                OBJECT_NAME(fk.parent_object_id) as TABLE_NAME,
                COL_NAME(fkc.parent_object_id, fkc.parent_column_id) as COLUMN_NAME,
                OBJECT_SCHEMA_NAME(fk.referenced_object_id) as REFERENCED_SCHEMA,
                OBJECT_NAME(fk.referenced_object_id) as REFERENCED_TABLE,
                COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) as REFERENCED_COLUMN
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc
                ON fk.object_id = fkc.constraint_object_id
            WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id) = ?
                AND OBJECT_NAME(fk.parent_object_id) = ?
        """
        foreign_keys = db.execute_query(fk_query, (schema, table))

        # Get indexes with detailed information
        index_query = """
            SELECT
                i.name as INDEX_NAME,
                i.type_desc as INDEX_TYPE,
                i.is_unique,
                i.is_primary_key,
                i.filter_definition as FILTER_DEFINITION,
                (
                    SELECT STRING_AGG(c.name + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE ' ASC' END, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal)
                    FROM sys.index_columns ic
                    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                    WHERE ic.object_id = i.object_id
                        AND ic.index_id = i.index_id
                        AND ic.is_included_column = 0
                ) as KEY_COLUMNS,
                (
                    SELECT STRING_AGG(c.name, ', ')
                    FROM sys.index_columns ic
                    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                    WHERE ic.object_id = i.object_id
                        AND ic.index_id = i.index_id
                        AND ic.is_included_column = 1
                ) as INCLUDED_COLUMNS
            FROM sys.indexes i
            WHERE i.object_id = OBJECT_ID(? + '.' + ?)
                AND i.name IS NOT NULL
            ORDER BY i.is_primary_key DESC, i.name
        """
        indexes = db.execute_query(index_query, (schema, table))

        # Load custom metadata from SQL
        custom_metadata = _store().get_catalog_metadata(connection_id, schema, table) or {}

        table_details = {
            'schema': schema,
            'table': table,
            'row_count': row_count,
            'columns': [
                {
                    'name': col[0],
                    'data_type': col[1],
                    'max_length': col[2],
                    'precision': col[3],
                    'scale': col[4],
                    'nullable': col[5] == 'YES',
                    'default': col[6],
                    'position': col[7],
                    'is_primary_key': col[8] == 'YES',
                    'description': custom_metadata.get('columns', {}).get(col[0], {}).get('description', '')
                }
                for col in columns
            ],
            'foreign_keys': [
                {
                    'name': fk[0],
                    'column': fk[2],
                    'referenced_schema': fk[3],
                    'referenced_table': fk[4],
                    'referenced_column': fk[5]
                }
                for fk in foreign_keys
            ],
            'indexes': [
                {
                    'name': idx[0],
                    'type': idx[1],
                    'is_unique': idx[2],
                    'is_primary_key': idx[3],
                    'filter_definition': idx[4],
                    'key_columns': idx[5],
                    'included_columns': idx[6]
                }
                for idx in indexes
            ],
            'description': custom_metadata.get('description', ''),
            'tags': custom_metadata.get('tags', []),
            'owner': custom_metadata.get('owner', ''),
        }

        return jsonify(table_details), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@catalog_bp.route('/table/<schema>/<table>/metadata', methods=['POST'])
def update_table_metadata(schema, table):
    """Update custom metadata for a table (description, tags, owner, column descriptions)"""
    try:
        connection_id = request.args.get('connection_id')

        if not all([connection_id, schema, table]):
            return jsonify({'error': 'connection_id, schema, and table are required'}), 400

        metadata = request.json

        _store().save_catalog_metadata(connection_id, schema, table, metadata)

        return jsonify({'success': True, 'message': 'Metadata updated successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@catalog_bp.route('/search', methods=['POST'])
def search_catalog():
    """Search for tables and columns by name or description"""
    try:
        data = request.json
        connection_id = data.get('connection_id')
        query = data.get('query', '').lower()

        if not connection_id or not query:
            return jsonify({'error': 'connection_id and query are required'}), 400

        connection = _store().get_connection(connection_id)
        if not connection:
            return jsonify({'error': 'Connection not found'}), 404

        db = DBConnector(connection)

        # Search tables
        tables_query = """
            SELECT DISTINCT
                t.TABLE_SCHEMA,
                t.TABLE_NAME,
                t.TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES t
            WHERE t.TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
                AND (LOWER(t.TABLE_NAME) LIKE ? OR LOWER(t.TABLE_SCHEMA) LIKE ?)
            ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
        """
        search_pattern = f'%{query}%'
        tables = db.execute_query(tables_query, (search_pattern, search_pattern))

        # Search columns
        columns_query = """
            SELECT DISTINCT
                c.TABLE_SCHEMA,
                c.TABLE_NAME,
                c.COLUMN_NAME,
                c.DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS c
            WHERE c.TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
                AND LOWER(c.COLUMN_NAME) LIKE ?
            ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.COLUMN_NAME
        """
        columns = db.execute_query(columns_query, (search_pattern,))

        results = {
            'tables': [
                {
                    'schema': t[0],
                    'name': t[1],
                    'type': t[2]
                }
                for t in tables
            ],
            'columns': [
                {
                    'schema': c[0],
                    'table': c[1],
                    'column': c[2],
                    'data_type': c[3]
                }
                for c in columns
            ]
        }

        return jsonify(results), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@catalog_bp.route('/sample-data/<schema>/<table>', methods=['GET'])
def get_sample_data(schema, table):
    """Get sample rows from a table"""
    try:
        connection_id = request.args.get('connection_id')
        limit = int(request.args.get('limit', 10))

        if not all([connection_id, schema, table]):
            return jsonify({'error': 'connection_id, schema, and table are required'}), 400

        connection = _store().get_connection(connection_id)
        if not connection:
            return jsonify({'error': 'Connection not found'}), 404

        db = DBConnector(connection)

        # Get sample data
        sample_query = f"SELECT TOP {limit} * FROM [{schema}].[{table}]"
        rows = db.execute_query(sample_query)

        # Get column names
        columns_query = """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        """
        columns = db.execute_query(columns_query, (schema, table))
        column_names = [col[0] for col in columns]

        # Convert rows to dicts
        sample_data = [
            {column_names[i]: str(value) if value is not None else None
             for i, value in enumerate(row)}
            for row in rows
        ]

        return jsonify({
            'columns': column_names,
            'data': sample_data
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
