"""
Expectation Engine
Execute data quality checks and return results
"""
import uuid
from datetime import datetime

from services.db_connector import DBConnector


class ExpectationEngine:
    def __init__(self, store=None):
        self.store = store

    def get_expectation_library(self) -> dict:
        """Get catalog of available expectations"""
        return {
            'categories': {
                'column_value': {
                    'name': 'Column Value Checks',
                    'icon': '🔢',
                    'expectations': [
                        {
                            'id': 'expect_column_values_to_not_be_null',
                            'name': 'Not Null',
                            'icon': '❌',
                            'description': 'Column values should not be null',
                            'params': []
                        },
                        {
                            'id': 'expect_column_values_to_be_unique',
                            'name': 'Unique Values',
                            'icon': '🆔',
                            'description': 'Column values should be unique',
                            'params': []
                        },
                        {
                            'id': 'expect_column_values_to_be_between',
                            'name': 'Value Range',
                            'icon': '📊',
                            'description': 'Column values within min/max range',
                            'params': [
                                {'name': 'min_value', 'type': 'number', 'required': True},
                                {'name': 'max_value', 'type': 'number', 'required': True}
                            ]
                        },
                        {
                            'id': 'expect_column_values_to_match_regex',
                            'name': 'Match Pattern',
                            'icon': '🔤',
                            'description': 'Column values match regex pattern',
                            'params': [
                                {'name': 'regex', 'type': 'string', 'required': True}
                            ]
                        }
                    ]
                },
                'table_checks': {
                    'name': 'Table-Level Checks',
                    'icon': '📋',
                    'expectations': [
                        {
                            'id': 'expect_table_row_count_to_be_between',
                            'name': 'Row Count Range',
                            'icon': '🔢',
                            'description': 'Table row count within range',
                            'params': [
                                {'name': 'min_value', 'type': 'number', 'required': True},
                                {'name': 'max_value', 'type': 'number', 'required': False}
                            ]
                        }
                    ]
                },
                'freshness': {
                    'name': 'Data Freshness',
                    'icon': '⏱️',
                    'expectations': [
                        {
                            'id': 'expect_column_values_to_be_recent',
                            'name': 'Recent Data',
                            'icon': '🕐',
                            'description': 'Data updated within threshold',
                            'params': [
                                {'name': 'max_age_hours', 'type': 'number', 'default': 24}
                            ]
                        }
                    ]
                },
                'date_keys': {
                    'name': 'Date Key Validation',
                    'icon': '📅',
                    'expectations': [
                        {
                            'id': 'expect_column_values_to_be_valid_datekey',
                            'name': 'Valid Date Key',
                            'icon': '🗓️',
                            'description': 'Validate integer date keys (YYYYMMDD format)',
                            'params': [
                                {'name': 'min_date', 'type': 'number', 'required': False},
                                {'name': 'max_date', 'type': 'number', 'required': False}
                            ]
                        }
                    ]
                }
            }
        }

    def _get_connection(self, connection_id: str) -> dict:
        """Get connection config from the metadata store."""
        connection = self.store.get_connection(connection_id)
        if not connection:
            raise ValueError(f"Connection not found: {connection_id}")
        return connection

    def validate_expectation(self, connection_id: str, expectation: dict) -> dict:
        """Execute a single expectation and return results"""
        connection = self._get_connection(connection_id)
        db = DBConnector(connection)
        exp_type = expectation['type']

        # Route to appropriate validator
        if exp_type == 'expect_column_values_to_not_be_null':
            return self._validate_not_null(db, expectation)
        elif exp_type == 'expect_column_values_to_be_between':
            return self._validate_between(db, expectation)
        elif exp_type == 'expect_column_values_to_be_unique':
            return self._validate_unique(db, expectation)
        elif exp_type == 'expect_column_values_to_match_regex':
            return self._validate_regex(db, expectation)
        elif exp_type == 'expect_table_row_count_to_be_between':
            return self._validate_row_count(db, expectation)
        elif exp_type == 'expect_column_values_to_be_recent':
            return self._validate_recent(db, expectation)
        elif exp_type == 'expect_column_values_to_be_valid_datekey':
            return self._validate_datekey(db, expectation)
        else:
            return {'error': f'Unknown expectation type: {exp_type}'}

    def _validate_not_null(self, db: DBConnector, expectation: dict) -> dict:
        """Validate not null constraint"""
        target = expectation.get('target', {})
        schema = target.get('schema', 'dbo')
        table = target.get('table')
        column = expectation.get('column')

        if not table or not column:
            raise ValueError("Table and column are required")

        query = f"""
            SELECT
                COUNT(*) as total_rows,
                SUM(CASE WHEN [{column}] IS NULL THEN 1 ELSE 0 END) as null_count
            FROM [{schema}].[{table}]
        """

        result = db.execute_query_dict(query)[0]
        total = result['total_rows']
        nulls = result['null_count']

        success = nulls == 0
        success_percentage = ((total - nulls) / total * 100) if total > 0 else 0

        return {
            'success': success,
            'expectation_type': expectation['type'],
            'observed_value': {
                'total_rows': total,
                'null_count': nulls,
                'success_percentage': round(success_percentage, 2)
            }
        }

    def _validate_unique(self, db: DBConnector, expectation: dict) -> dict:
        """Validate uniqueness constraint"""
        target = expectation.get('target', {})
        schema = target.get('schema', 'dbo')
        table = target.get('table')
        column = expectation.get('column')

        if not table or not column:
            raise ValueError("Table and column are required")

        query = f"""
            SELECT
                COUNT(*) as total_rows,
                COUNT(DISTINCT [{column}]) as unique_count
            FROM [{schema}].[{table}]
            WHERE [{column}] IS NOT NULL
        """

        result = db.execute_query_dict(query)[0]
        total = result['total_rows']
        unique = result['unique_count']

        success = total == unique
        success_percentage = (unique / total * 100) if total > 0 else 0

        # Get sample duplicates
        dup_query = f"""
            SELECT TOP 5 [{column}], COUNT(*) as count
            FROM [{schema}].[{table}]
            WHERE [{column}] IS NOT NULL
            GROUP BY [{column}]
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
        """

        duplicates = db.execute_query_dict(dup_query)

        return {
            'success': success,
            'expectation_type': expectation['type'],
            'observed_value': {
                'total_rows': total,
                'unique_count': unique,
                'duplicate_count': total - unique,
                'success_percentage': round(success_percentage, 2)
            },
            'failed_samples': duplicates if not success else []
        }

    def _validate_between(self, db: DBConnector, expectation: dict) -> dict:
        """Validate values are between min and max"""
        target = expectation.get('target', {})
        schema = target.get('schema', 'dbo')
        table = target.get('table')
        column = expectation.get('column')
        params = expectation.get('params', {})
        min_val = params.get('min_value')
        max_val = params.get('max_value')

        if not table or not column:
            raise ValueError("Table and column are required")
        if min_val is None or max_val is None:
            raise ValueError("min_value and max_value are required")

        query = f"""
            SELECT
                COUNT(*) as total_rows,
                SUM(CASE
                    WHEN [{column}] < {min_val} OR [{column}] > {max_val}
                    THEN 1 ELSE 0
                END) as failed_count
            FROM [{schema}].[{table}]
            WHERE [{column}] IS NOT NULL
        """

        result = db.execute_query_dict(query)[0]
        total = result['total_rows']
        failed = result['failed_count']

        success = failed == 0
        success_percentage = ((total - failed) / total * 100) if total > 0 else 0

        # Get sample of failed rows
        sample_query = f"""
            SELECT TOP 10 [{column}] as value
            FROM [{schema}].[{table}]
            WHERE [{column}] < {min_val} OR [{column}] > {max_val}
        """

        failed_samples = db.execute_query_dict(sample_query)

        return {
            'success': success,
            'expectation_type': expectation['type'],
            'observed_value': {
                'total_rows': total,
                'failed_count': failed,
                'success_percentage': round(success_percentage, 2)
            },
            'failed_samples': failed_samples,
            'details': {
                'min_value': min_val,
                'max_value': max_val
            }
        }

    def _validate_regex(self, db: DBConnector, expectation: dict) -> dict:
        """Validate values match regex pattern"""
        target = expectation.get('target', {})
        schema = target.get('schema', 'dbo')
        table = target.get('table')
        column = expectation.get('column')
        params = expectation.get('params', {})
        regex = params.get('regex', '')

        if not table or not column:
            raise ValueError("Table and column are required")

        # Common email pattern for SQL Server
        if 'email' in regex.lower() or '@' in regex:
            # Simple email validation
            query = f"""
                SELECT
                    COUNT(*) as total_rows,
                    SUM(CASE
                        WHEN [{column}] NOT LIKE '%_@__%.__%'
                        THEN 1 ELSE 0
                    END) as failed_count
                FROM [{schema}].[{table}]
                WHERE [{column}] IS NOT NULL
            """
        else:
            # Generic pattern check (simplified)
            query = f"""
                SELECT
                    COUNT(*) as total_rows,
                    0 as failed_count
                FROM [{schema}].[{table}]
                WHERE [{column}] IS NOT NULL
            """

        result = db.execute_query_dict(query)[0]
        total = result['total_rows']
        failed = result['failed_count']

        success = failed == 0
        success_percentage = ((total - failed) / total * 100) if total > 0 else 0

        return {
            'success': success,
            'expectation_type': expectation['type'],
            'observed_value': {
                'total_rows': total,
                'failed_count': failed,
                'success_percentage': round(success_percentage, 2)
            },
            'details': {
                'pattern': regex
            }
        }

    def _validate_row_count(self, db: DBConnector, expectation: dict) -> dict:
        """Validate table row count"""
        target = expectation.get('target', {})
        schema = target.get('schema', 'dbo')
        table = target.get('table')
        params = expectation.get('params', {})
        min_val = params.get('min_value', 0)
        max_val = params.get('max_value')

        if not table:
            raise ValueError("Table is required")

        query = f"SELECT COUNT(*) as row_count FROM [{schema}].[{table}]"
        result = db.execute_query_dict(query)[0]
        row_count = result['row_count']

        if max_val is not None:
            success = min_val <= row_count <= max_val
        else:
            success = row_count >= min_val

        return {
            'success': success,
            'expectation_type': expectation['type'],
            'observed_value': {
                'row_count': row_count
            },
            'details': {
                'min_value': min_val,
                'max_value': max_val
            }
        }

    def _validate_recent(self, db: DBConnector, expectation: dict) -> dict:
        """Validate data freshness"""
        target = expectation.get('target', {})
        schema = target.get('schema', 'dbo')
        table = target.get('table')
        column = expectation.get('column')
        params = expectation.get('params', {})
        max_age_hours = params.get('max_age_hours', 24)

        if not table or not column:
            raise ValueError("Table and column are required")

        query = f"""
            SELECT
                MAX([{column}]) as max_date,
                DATEDIFF(HOUR, MAX([{column}]), GETDATE()) as age_hours
            FROM [{schema}].[{table}]
        """

        result = db.execute_query_dict(query)[0]
        max_date = result['max_date']
        age_hours = result['age_hours'] or 0

        success = age_hours <= max_age_hours

        return {
            'success': success,
            'expectation_type': expectation['type'],
            'observed_value': {
                'max_date': str(max_date) if max_date else None,
                'age_hours': age_hours
            },
            'details': {
                'threshold_hours': max_age_hours
            }
        }

    def _validate_datekey(self, db: DBConnector, expectation: dict) -> dict:
        """Validate integer date keys in YYYYMMDD format"""
        target = expectation.get('target', {})
        schema = target.get('schema', 'dbo')
        table = target.get('table')
        column = expectation.get('column')
        params = expectation.get('params', {})
        min_date = params.get('min_date')
        max_date = params.get('max_date')

        if not table or not column:
            raise ValueError("Table and column are required")

        query = f"""
            WITH DateKeyValidation AS (
                SELECT
                    [{column}] as datekey_value,
                    CASE
                        WHEN [{column}] IS NULL THEN 'NULL'
                        WHEN TRY_CONVERT(INT, [{column}]) IS NULL THEN 'NOT_INTEGER'
                        WHEN LEN(CAST([{column}] AS VARCHAR)) != 8 THEN 'INVALID_LENGTH'
                        WHEN TRY_CONVERT(DATE,
                            STUFF(STUFF(CAST([{column}] AS VARCHAR), 7, 0, '-'), 5, 0, '-')
                        ) IS NULL THEN 'INVALID_DATE'
                        ELSE 'VALID'
                    END as validation_status,
                    TRY_CONVERT(DATE,
                        STUFF(STUFF(CAST([{column}] AS VARCHAR), 7, 0, '-'), 5, 0, '-')
                    ) as converted_date
                FROM [{schema}].[{table}]
            )
            SELECT
                COUNT(*) as total_rows,
                SUM(CASE WHEN validation_status = 'VALID' THEN 1 ELSE 0 END) as valid_count,
                SUM(CASE WHEN validation_status != 'VALID' THEN 1 ELSE 0 END) as invalid_count,
                MIN(CASE WHEN validation_status = 'VALID' THEN converted_date END) as min_date_value,
                MAX(CASE WHEN validation_status = 'VALID' THEN converted_date END) as max_date_value
            FROM DateKeyValidation
        """

        result = db.execute_query_dict(query)[0]
        total = result['total_rows']
        valid = result['valid_count']
        invalid = result['invalid_count']

        # Check range if specified
        range_violations = 0
        if min_date or max_date:
            range_query = f"""
                SELECT COUNT(*) as count
                FROM [{schema}].[{table}]
                WHERE TRY_CONVERT(DATE,
                    STUFF(STUFF(CAST([{column}] AS VARCHAR), 7, 0, '-'), 5, 0, '-')
                ) IS NOT NULL
            """
            if min_date and max_date:
                range_query += f" AND ([{column}] < {min_date} OR [{column}] > {max_date})"
            elif min_date:
                range_query += f" AND [{column}] < {min_date}"
            elif max_date:
                range_query += f" AND [{column}] > {max_date}"

            range_result = db.execute_query_dict(range_query)[0]
            range_violations = range_result['count']

        # Get samples of invalid date keys
        sample_query = f"""
            SELECT TOP 10
                [{column}] as datekey_value,
                CASE
                    WHEN [{column}] IS NULL THEN 'NULL value'
                    WHEN TRY_CONVERT(INT, [{column}]) IS NULL THEN 'Not an integer'
                    WHEN LEN(CAST([{column}] AS VARCHAR)) != 8 THEN 'Invalid length (need 8 digits)'
                    WHEN TRY_CONVERT(DATE,
                        STUFF(STUFF(CAST([{column}] AS VARCHAR), 7, 0, '-'), 5, 0, '-')
                    ) IS NULL THEN 'Invalid date (e.g., 20261332)'
                    ELSE 'Valid'
                END as issue
            FROM [{schema}].[{table}]
            WHERE
                [{column}] IS NULL
                OR TRY_CONVERT(INT, [{column}]) IS NULL
                OR LEN(CAST([{column}] AS VARCHAR)) != 8
                OR TRY_CONVERT(DATE,
                    STUFF(STUFF(CAST([{column}] AS VARCHAR), 7, 0, '-'), 5, 0, '-')
                ) IS NULL
        """

        failed_samples = db.execute_query_dict(sample_query)

        # Format sample dates that ARE valid to show conversion
        valid_sample_query = f"""
            SELECT TOP 5
                [{column}] as datekey_value,
                FORMAT(TRY_CONVERT(DATE,
                    STUFF(STUFF(CAST([{column}] AS VARCHAR), 7, 0, '-'), 5, 0, '-')
                ), 'MM/dd/yyyy') as formatted_date
            FROM [{schema}].[{table}]
            WHERE TRY_CONVERT(DATE,
                STUFF(STUFF(CAST([{column}] AS VARCHAR), 7, 0, '-'), 5, 0, '-')
            ) IS NOT NULL
            ORDER BY [{column}]
        """

        valid_samples = db.execute_query_dict(valid_sample_query)

        total_failures = invalid + range_violations
        success = total_failures == 0
        success_percentage = ((total - total_failures) / total * 100) if total > 0 else 0

        return {
            'success': success,
            'expectation_type': expectation['type'],
            'observed_value': {
                'total_rows': total,
                'valid_datekeys': valid,
                'invalid_datekeys': invalid,
                'range_violations': range_violations if (min_date or max_date) else None,
                'success_percentage': round(success_percentage, 2),
                'min_date': str(result['min_date_value']) if result['min_date_value'] else None,
                'max_date': str(result['max_date_value']) if result['max_date_value'] else None
            },
            'failed_samples': failed_samples if invalid > 0 else [],
            'valid_samples': valid_samples,
            'details': {
                'min_date_expected': min_date,
                'max_date_expected': max_date,
                'format': 'YYYYMMDD (e.g., 20260203 = 02/03/2026)'
            }
        }

    def get_available_tables(self, connection_id: str) -> dict:
        """Get list of all available schemas and tables in the database"""
        connection = self._get_connection(connection_id)
        db = DBConnector(connection)

        try:
            # Query to get all user tables grouped by schema
            query = """
                SELECT
                    TABLE_SCHEMA,
                    TABLE_NAME,
                    TABLE_TYPE
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE = 'BASE TABLE'
                AND TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
                ORDER BY TABLE_SCHEMA, TABLE_NAME
            """

            results = db.execute_query_dict(query)

            # Group tables by schema
            schemas = {}
            for row in results:
                schema_name = row['TABLE_SCHEMA']
                table_name = row['TABLE_NAME']

                if schema_name not in schemas:
                    schemas[schema_name] = []

                schemas[schema_name].append(table_name)

            # Convert to list format for frontend
            schema_list = [
                {
                    'schema': schema_name,
                    'tables': tables
                }
                for schema_name, tables in schemas.items()
            ]

            return {
                'schemas': schema_list,
                'total_tables': len(results)
            }

        except Exception as e:
            return {
                'error': str(e),
                'schemas': [],
                'total_tables': 0
            }

    def get_table_schema(self, connection_id: str, schema: str, table: str) -> dict:
        """Get SQL schema/DDL for a table"""
        connection = self._get_connection(connection_id)
        db = DBConnector(connection)

        try:
            # Get column information
            columns_query = f"""
                SELECT
                    c.COLUMN_NAME,
                    c.DATA_TYPE,
                    c.CHARACTER_MAXIMUM_LENGTH,
                    c.NUMERIC_PRECISION,
                    c.NUMERIC_SCALE,
                    c.IS_NULLABLE,
                    c.COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS c
                WHERE c.TABLE_SCHEMA = '{schema}'
                AND c.TABLE_NAME = '{table}'
                ORDER BY c.ORDINAL_POSITION
            """

            columns = db.execute_query_dict(columns_query)

            if not columns:
                return {
                    'error': f'Table {schema}.{table} not found',
                    'sql': None,
                    'columns': []
                }

            # Get primary key information
            pk_query = f"""
                SELECT c.COLUMN_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE c
                    ON tc.CONSTRAINT_NAME = c.CONSTRAINT_NAME
                    AND tc.TABLE_SCHEMA = c.TABLE_SCHEMA
                WHERE tc.TABLE_SCHEMA = '{schema}'
                AND tc.TABLE_NAME = '{table}'
                AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            """

            pk_columns = [row['COLUMN_NAME'] for row in db.execute_query_dict(pk_query)]

            # Build CREATE TABLE statement
            sql_lines = [f"CREATE TABLE [{schema}].[{table}] ("]

            column_definitions = []
            for col in columns:
                col_name = col['COLUMN_NAME']
                data_type = col['DATA_TYPE'].upper()

                # Add length/precision for applicable types
                if col['CHARACTER_MAXIMUM_LENGTH'] and col['CHARACTER_MAXIMUM_LENGTH'] > 0:
                    if col['CHARACTER_MAXIMUM_LENGTH'] == -1:
                        data_type += "(MAX)"
                    else:
                        data_type += f"({col['CHARACTER_MAXIMUM_LENGTH']})"
                elif col['NUMERIC_PRECISION'] and col['DATA_TYPE'] in ['decimal', 'numeric']:
                    scale = col['NUMERIC_SCALE'] if col['NUMERIC_SCALE'] else 0
                    data_type += f"({col['NUMERIC_PRECISION']},{scale})"

                # Nullable
                nullable = "NULL" if col['IS_NULLABLE'] == 'YES' else "NOT NULL"

                # Default
                default = ""
                if col['COLUMN_DEFAULT']:
                    default = f" DEFAULT {col['COLUMN_DEFAULT']}"

                # Primary key indicator
                pk_indicator = " -- PRIMARY KEY" if col_name in pk_columns else ""

                column_definitions.append(f"    [{col_name}] {data_type} {nullable}{default}{pk_indicator}")

            sql_lines.append(",\n".join(column_definitions))

            # Add primary key constraint if exists
            if pk_columns:
                pk_cols = ", ".join([f"[{col}]" for col in pk_columns])
                sql_lines.append(f",\n    PRIMARY KEY ({pk_cols})")

            sql_lines.append(");")

            sql = "\n".join(sql_lines)

            return {
                'schema': schema,
                'table': table,
                'sql': sql,
                'columns': columns,
                'primary_keys': pk_columns,
                'column_count': len(columns)
            }

        except Exception as e:
            return {
                'error': str(e),
                'sql': None,
                'columns': []
            }

    def run_suite(self, suite: dict) -> dict:
        """Run all expectations in a suite"""
        suite_id = suite.get('suite_id')
        suite_name = suite.get('name', 'Unnamed Suite')
        connection_id = suite['connection_id']
        expectations = suite.get('expectations', [])

        start_time = datetime.now()
        results = []

        for idx, expectation in enumerate(expectations):
            exp_start = datetime.now()
            try:
                result = self.validate_expectation(connection_id, expectation)
                exp_duration = (datetime.now() - exp_start).total_seconds() * 1000

                results.append({
                    'expectation_id': expectation.get('id', f'exp_{idx}'),
                    'expectation_name': expectation.get('name', expectation['type']),
                    'expectation_type': expectation['type'],
                    'column': expectation.get('column'),
                    'execution_time_ms': round(exp_duration, 2),
                    **result
                })
            except Exception as e:
                results.append({
                    'expectation_id': expectation.get('id', f'exp_{idx}'),
                    'expectation_name': expectation.get('name', expectation['type']),
                    'success': False,
                    'error': str(e)
                })

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        passed = sum(1 for r in results if r.get('success'))
        failed = sum(1 for r in results if r.get('success') is False)
        errors = sum(1 for r in results if 'error' in r)

        return {
            'result_id': f'res_{datetime.now().strftime("%Y%m%d_%H%M%S")}_{uuid.uuid4().hex[:8]}',
            'suite_id': suite_id,
            'suite_name': suite_name,
            'execution_time': start_time.isoformat(),
            'duration_seconds': round(duration, 2),
            'status': 'passed' if failed == 0 and errors == 0 else 'failed',
            'statistics': {
                'total_expectations': len(results),
                'passed': passed,
                'failed': failed,
                'errors': errors
            },
            'results': results
        }
