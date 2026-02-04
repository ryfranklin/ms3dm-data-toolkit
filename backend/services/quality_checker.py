"""
Data Quality Checker Service
Performs various data quality checks on SQL Server databases
"""
from typing import Dict, List, Optional, Any
from services.db_connector import DBConnector
from datetime import datetime, timedelta

class QualityChecker:
    """Execute data quality checks on database tables"""
    
    def __init__(self, connection_config: Dict):
        """
        Initialize quality checker
        
        Args:
            connection_config: Connection configuration dictionary
        """
        self.db = DBConnector(connection_config)
    
    def run_checks(self, check_types: List[str], tables: List[str] = None, config: Dict = None) -> Dict:
        """
        Run specified quality checks
        
        Args:
            check_types: List of check types to run
            tables: List of tables to check (None = all tables)
            config: Configuration options for checks
            
        Returns:
            Dictionary with check results
        """
        if config is None:
            config = {}
        
        results = {
            'timestamp': datetime.utcnow().isoformat(),
            'check_types': check_types,
            'tables_checked': [],
            'summary': {},
            'details': {}
        }
        
        try:
            # Get tables to check
            if tables is None or len(tables) == 0:
                tables = self._get_all_tables()
            
            results['tables_checked'] = tables
            
            # Run each check type
            if 'null_analysis' in check_types:
                results['details']['null_analysis'] = self._check_null_values(tables, config)
                results['summary']['null_analysis'] = self._summarize_null_analysis(results['details']['null_analysis'])
            
            if 'schema_validation' in check_types:
                results['details']['schema_validation'] = self._check_schema(tables, config)
                results['summary']['schema_validation'] = self._summarize_schema_validation(results['details']['schema_validation'])
            
            if 'gap_detection' in check_types:
                results['details']['gap_detection'] = self._check_data_gaps(tables, config)
                results['summary']['gap_detection'] = self._summarize_gap_detection(results['details']['gap_detection'])
            
            if 'freshness' in check_types:
                results['details']['freshness'] = self._check_freshness(tables, config)
                results['summary']['freshness'] = self._summarize_freshness(results['details']['freshness'])
            
            if 'data_profiling' in check_types:
                results['details']['data_profiling'] = self._check_data_profiling(tables, config)
                results['summary']['data_profiling'] = self._summarize_data_profiling(results['details']['data_profiling'])
            
            results['status'] = 'success'
            
        except Exception as e:
            results['status'] = 'error'
            results['error'] = str(e)
        
        return results
    
    def _get_all_tables(self) -> List[str]:
        """Get list of all tables in the database"""
        query = """
            SELECT TABLE_SCHEMA + '.' + TABLE_NAME as full_name
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_SCHEMA, TABLE_NAME
        """
        
        results = self.db.execute_query_dict(query)
        return [r['full_name'] for r in results]
    
    def _check_null_values(self, tables: List[str], config: Dict) -> Dict:
        """
        Check for NULL values in tables
        
        Args:
            tables: List of tables to check
            config: Configuration with null_threshold
            
        Returns:
            Dictionary with NULL analysis results
        """
        null_threshold = config.get('null_threshold', 0.1)  # 10% default
        results = {}
        
        for table in tables:
            try:
                # Parse schema and table name
                parts = table.split('.')
                if len(parts) == 2:
                    schema, table_name = parts
                else:
                    schema = 'dbo'
                    table_name = table
                
                # Get columns for this table
                columns_query = """
                    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                """
                columns = self.db.execute_query_dict(columns_query, (schema, table_name))
                
                # Get total row count
                count_query = f"SELECT COUNT(*) as total FROM [{schema}].[{table_name}]"
                total_rows = self.db.execute_query_dict(count_query)[0]['total']
                
                if total_rows == 0:
                    results[table] = {
                        'status': 'empty',
                        'total_rows': 0,
                        'columns': []
                    }
                    continue
                
                # Check each column for NULLs
                column_results = []
                for col in columns:
                    col_name = col['COLUMN_NAME']
                    
                    null_query = f"""
                        SELECT COUNT(*) as null_count 
                        FROM [{schema}].[{table_name}]
                        WHERE [{col_name}] IS NULL
                    """
                    
                    null_count = self.db.execute_query_dict(null_query)[0]['null_count']
                    null_percentage = (null_count / total_rows) * 100
                    
                    is_issue = null_percentage > (null_threshold * 100)
                    
                    column_results.append({
                        'column': col_name,
                        'data_type': col['DATA_TYPE'],
                        'is_nullable': col['IS_NULLABLE'],
                        'null_count': null_count,
                        'null_percentage': round(null_percentage, 2),
                        'is_issue': is_issue
                    })
                
                results[table] = {
                    'status': 'checked',
                    'total_rows': total_rows,
                    'columns': column_results,
                    'issues_found': sum(1 for c in column_results if c['is_issue'])
                }
                
            except Exception as e:
                results[table] = {
                    'status': 'error',
                    'error': str(e)
                }
        
        return results
    
    def _check_schema(self, tables: List[str], config: Dict) -> Dict:
        """
        Validate schema against expected structure
        
        Args:
            tables: List of tables to check
            config: Configuration with expected_schema
            
        Returns:
            Dictionary with schema validation results
        """
        expected_schema = config.get('expected_schema', {})
        results = {}
        
        for table in tables:
            try:
                parts = table.split('.')
                if len(parts) == 2:
                    schema, table_name = parts
                else:
                    schema = 'dbo'
                    table_name = table
                
                # Get current columns
                columns_query = """
                    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                    ORDER BY ORDINAL_POSITION
                """
                current_columns = self.db.execute_query_dict(columns_query, (schema, table_name))
                
                # Check against expected schema if provided
                issues = []
                if table in expected_schema:
                    expected_cols = expected_schema[table]
                    current_col_names = {c['COLUMN_NAME'] for c in current_columns}
                    expected_col_names = set(expected_cols.keys())
                    
                    # Check for missing columns
                    missing = expected_col_names - current_col_names
                    if missing:
                        issues.append({
                            'type': 'missing_columns',
                            'columns': list(missing)
                        })
                    
                    # Check for extra columns
                    extra = current_col_names - expected_col_names
                    if extra:
                        issues.append({
                            'type': 'extra_columns',
                            'columns': list(extra)
                        })
                    
                    # Check for type mismatches
                    for col in current_columns:
                        col_name = col['COLUMN_NAME']
                        if col_name in expected_cols:
                            expected_type = expected_cols[col_name].get('type')
                            if expected_type and col['DATA_TYPE'] != expected_type:
                                issues.append({
                                    'type': 'type_mismatch',
                                    'column': col_name,
                                    'expected': expected_type,
                                    'actual': col['DATA_TYPE']
                                })
                
                results[table] = {
                    'status': 'checked',
                    'columns': current_columns,
                    'issues': issues,
                    'has_expected_schema': table in expected_schema
                }
                
            except Exception as e:
                results[table] = {
                    'status': 'error',
                    'error': str(e)
                }
        
        return results
    
    def _check_data_gaps(self, tables: List[str], config: Dict) -> Dict:
        """
        Check for data gaps in sequences (dates, IDs)
        
        Args:
            tables: List of tables to check
            config: Configuration with sequence_columns
            
        Returns:
            Dictionary with gap detection results
        """
        sequence_columns = config.get('sequence_columns', {})
        results = {}
        
        for table in tables:
            try:
                parts = table.split('.')
                if len(parts) == 2:
                    schema, table_name = parts
                else:
                    schema = 'dbo'
                    table_name = table
                
                table_results = {
                    'status': 'checked',
                    'duplicate_checks': [],
                    'sequence_gaps': []
                }
                
                # Check for duplicate primary keys
                pk_query = """
                    SELECT COLUMN_NAME
                    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                    WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
                    AND TABLE_SCHEMA = ? AND TABLE_NAME = ?
                """
                pk_columns = self.db.execute_query_dict(pk_query, (schema, table_name))
                
                for pk_col in pk_columns:
                    col_name = pk_col['COLUMN_NAME']
                    dup_query = f"""
                        SELECT TOP 10 [{col_name}] as value, COUNT(*) as count
                        FROM [{schema}].[{table_name}]
                        GROUP BY [{col_name}]
                        HAVING COUNT(*) > 1
                        ORDER BY COUNT(*) DESC
                    """
                    
                    duplicates = self.db.execute_query_dict(dup_query)
                    
                    table_results['duplicate_checks'].append({
                        'column': col_name,
                        'duplicates_found': len(duplicates),
                        'is_issue': len(duplicates) > 0,
                        'duplicate_values': [
                            {
                                'value': str(dup['value']),
                                'count': dup['count']
                            }
                            for dup in duplicates
                        ] if len(duplicates) > 0 else []
                    })
                
                # Check for sequence gaps if configured
                if table in sequence_columns:
                    for col_name in sequence_columns[table]:
                        try:
                            # First, get gap ranges
                            gap_query = f"""
                                WITH numbered AS (
                                    SELECT [{col_name}],
                                           LEAD([{col_name}]) OVER (ORDER BY [{col_name}]) as next_val
                                    FROM [{schema}].[{table_name}]
                                    WHERE [{col_name}] IS NOT NULL
                                )
                                SELECT TOP 10
                                    [{col_name}] as gap_start,
                                    next_val as gap_end,
                                    (next_val - [{col_name}] - 1) as missing_count
                                FROM numbered
                                WHERE next_val - [{col_name}] > 1
                                ORDER BY missing_count DESC, [{col_name}]
                            """
                            
                            gap_ranges = self.db.execute_query_dict(gap_query)
                            
                            # Get statistics
                            stats_query = f"""
                                SELECT 
                                    MIN([{col_name}]) as min_val,
                                    MAX([{col_name}]) as max_val,
                                    COUNT(DISTINCT [{col_name}]) as distinct_count
                                FROM [{schema}].[{table_name}]
                                WHERE [{col_name}] IS NOT NULL
                            """
                            stats = self.db.execute_query_dict(stats_query)[0]
                            
                            # Calculate expected vs actual
                            if stats['min_val'] is not None and stats['max_val'] is not None:
                                expected_count = int(stats['max_val']) - int(stats['min_val']) + 1
                                actual_count = stats['distinct_count']
                                total_gaps = expected_count - actual_count
                            else:
                                total_gaps = 0
                            
                            table_results['sequence_gaps'].append({
                                'column': col_name,
                                'gaps_found': len(gap_ranges),
                                'total_missing': total_gaps,
                                'is_issue': len(gap_ranges) > 0,
                                'min_value': int(stats['min_val']) if stats['min_val'] is not None else None,
                                'max_value': int(stats['max_val']) if stats['max_val'] is not None else None,
                                'actual_count': stats['distinct_count'],
                                'gap_ranges': [
                                    {
                                        'start': int(gap['gap_start']),
                                        'end': int(gap['gap_end']),
                                        'missing_count': int(gap['missing_count'])
                                    }
                                    for gap in gap_ranges
                                ] if len(gap_ranges) > 0 else []
                            })
                        except:
                            # Column might not be suitable for sequence checking
                            pass
                
                results[table] = table_results
                
            except Exception as e:
                results[table] = {
                    'status': 'error',
                    'error': str(e)
                }
        
        return results
    
    def _check_freshness(self, tables: List[str], config: Dict) -> Dict:
        """
        Check data freshness based on timestamp columns
        
        Args:
            tables: List of tables to check
            config: Configuration with freshness_columns and thresholds
            
        Returns:
            Dictionary with freshness check results
        """
        freshness_config = config.get('freshness_columns', {})
        default_threshold_hours = config.get('freshness_threshold_hours', 24)
        
        results = {}
        
        for table in tables:
            try:
                parts = table.split('.')
                if len(parts) == 2:
                    schema, table_name = parts
                else:
                    schema = 'dbo'
                    table_name = table
                
                # Find datetime columns
                datetime_query = """
                    SELECT COLUMN_NAME
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                    AND DATA_TYPE IN ('datetime', 'datetime2', 'date', 'timestamp')
                    ORDER BY ORDINAL_POSITION
                """
                datetime_columns = self.db.execute_query_dict(datetime_query, (schema, table_name))
                
                if not datetime_columns:
                    results[table] = {
                        'status': 'no_datetime_columns',
                        'columns': []
                    }
                    continue
                
                column_results = []
                for col in datetime_columns:
                    col_name = col['COLUMN_NAME']
                    
                    # Get max timestamp
                    max_query = f"""
                        SELECT MAX([{col_name}]) as max_date
                        FROM [{schema}].[{table_name}]
                    """
                    
                    max_result = self.db.execute_query_dict(max_query)
                    max_date = max_result[0]['max_date']
                    
                    if max_date:
                        # Calculate age
                        now = datetime.utcnow()
                        if isinstance(max_date, str):
                            max_date = datetime.fromisoformat(max_date.replace('Z', '+00:00'))
                        
                        age_hours = (now - max_date).total_seconds() / 3600
                        
                        # Get threshold for this column
                        threshold = freshness_config.get(table, {}).get(col_name, default_threshold_hours)
                        
                        is_stale = age_hours > threshold
                        
                        column_results.append({
                            'column': col_name,
                            'max_date': max_date.isoformat() if hasattr(max_date, 'isoformat') else str(max_date),
                            'age_hours': round(age_hours, 2),
                            'threshold_hours': threshold,
                            'is_stale': is_stale
                        })
                    else:
                        column_results.append({
                            'column': col_name,
                            'max_date': None,
                            'age_hours': None,
                            'is_stale': False
                        })
                
                results[table] = {
                    'status': 'checked',
                    'columns': column_results,
                    'stale_columns': sum(1 for c in column_results if c.get('is_stale', False))
                }
                
            except Exception as e:
                results[table] = {
                    'status': 'error',
                    'error': str(e)
                }
        
        return results
    
    def _summarize_null_analysis(self, details: Dict) -> Dict:
        """Summarize NULL analysis results"""
        total_tables = len(details)
        tables_with_issues = sum(1 for t in details.values() if t.get('issues_found', 0) > 0)
        total_columns = sum(len(t.get('columns', [])) for t in details.values())
        columns_with_issues = sum(
            sum(1 for c in t.get('columns', []) if c.get('is_issue', False))
            for t in details.values()
        )
        
        return {
            'total_tables': total_tables,
            'tables_with_issues': tables_with_issues,
            'total_columns': total_columns,
            'columns_with_issues': columns_with_issues
        }
    
    def _summarize_schema_validation(self, details: Dict) -> Dict:
        """Summarize schema validation results"""
        total_tables = len(details)
        tables_with_issues = sum(1 for t in details.values() if len(t.get('issues', [])) > 0)
        
        return {
            'total_tables': total_tables,
            'tables_with_issues': tables_with_issues
        }
    
    def _summarize_gap_detection(self, details: Dict) -> Dict:
        """Summarize gap detection results"""
        total_tables = len(details)
        tables_with_duplicates = sum(
            1 for t in details.values()
            if any(c.get('is_issue', False) for c in t.get('duplicate_checks', []))
        )
        tables_with_gaps = sum(
            1 for t in details.values()
            if any(c.get('is_issue', False) for c in t.get('sequence_gaps', []))
        )
        
        return {
            'total_tables': total_tables,
            'tables_with_duplicates': tables_with_duplicates,
            'tables_with_gaps': tables_with_gaps
        }
    
    def _summarize_freshness(self, details: Dict) -> Dict:
        """Summarize freshness check results"""
        total_tables = len(details)
        tables_with_stale_data = sum(1 for t in details.values() if t.get('stale_columns', 0) > 0)
        
        return {
            'total_tables': total_tables,
            'tables_with_stale_data': tables_with_stale_data
        }
    
    def _check_data_profiling(self, tables: List[str], config: Dict) -> Dict:
        """
        Comprehensive data profiling for all columns
        
        Args:
            tables: List of tables to profile
            config: Configuration options
            
        Returns:
            Dictionary with profiling results
        """
        results = {}
        max_top_values = config.get('max_top_values', 10)
        outlier_method = config.get('outlier_method', 'iqr')  # 'iqr' or 'zscore'
        
        for table in tables:
            try:
                parts = table.split('.')
                if len(parts) == 2:
                    schema, table_name = parts
                else:
                    schema = 'dbo'
                    table_name = table
                
                # Get all columns with data types
                columns_query = """
                    SELECT 
                        COLUMN_NAME,
                        DATA_TYPE,
                        CHARACTER_MAXIMUM_LENGTH,
                        IS_NULLABLE
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                    ORDER BY ORDINAL_POSITION
                """
                columns = self.db.execute_query_dict(columns_query, (schema, table_name))
                
                # Get total row count
                count_query = f"SELECT COUNT(*) as total FROM [{schema}].[{table_name}]"
                total_rows = self.db.execute_query_dict(count_query)[0]['total']
                
                if total_rows == 0:
                    results[table] = {
                        'status': 'empty',
                        'total_rows': 0,
                        'columns': []
                    }
                    continue
                
                column_profiles = []
                
                for col in columns:
                    col_name = col['COLUMN_NAME']
                    data_type = col['DATA_TYPE']
                    
                    profile = {
                        'column': col_name,
                        'data_type': data_type,
                        'is_nullable': col['IS_NULLABLE']
                    }
                    
                    # Profile based on data type
                    if data_type in ('int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'real', 'money', 'smallmoney'):
                        profile.update(self._profile_numeric_column(schema, table_name, col_name, total_rows, outlier_method))
                    elif data_type in ('varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext'):
                        profile.update(self._profile_string_column(schema, table_name, col_name, total_rows, max_top_values))
                    elif data_type in ('datetime', 'datetime2', 'date', 'time', 'smalldatetime'):
                        profile.update(self._profile_datetime_column(schema, table_name, col_name, total_rows))
                    elif data_type == 'bit':
                        profile.update(self._profile_boolean_column(schema, table_name, col_name, total_rows))
                    
                    # Common profiling for all types
                    profile.update(self._profile_common(schema, table_name, col_name, total_rows))
                    
                    column_profiles.append(profile)
                
                results[table] = {
                    'status': 'profiled',
                    'total_rows': total_rows,
                    'total_columns': len(columns),
                    'columns': column_profiles
                }
                
            except Exception as e:
                results[table] = {
                    'status': 'error',
                    'error': str(e)
                }
        
        return results
    
    def _profile_numeric_column(self, schema: str, table: str, column: str, total_rows: int, outlier_method: str) -> Dict:
        """Profile numeric column with statistics"""
        try:
            stats_query = f"""
                SELECT 
                    MIN([{column}]) as min_value,
                    MAX([{column}]) as max_value,
                    AVG(CAST([{column}] AS FLOAT)) as mean_value,
                    STDEV(CAST([{column}] AS FLOAT)) as std_dev,
                    COUNT(CASE WHEN [{column}] = 0 THEN 1 END) as zero_count,
                    COUNT(CASE WHEN [{column}] < 0 THEN 1 END) as negative_count
                FROM [{schema}].[{table}]
                WHERE [{column}] IS NOT NULL
            """
            stats = self.db.execute_query_dict(stats_query)[0]
            
            # Calculate percentiles
            percentiles_query = f"""
                SELECT 
                    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY [{column}]) OVER () as q1,
                    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY [{column}]) OVER () as median,
                    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY [{column}]) OVER () as q3,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY [{column}]) OVER () as p95,
                    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY [{column}]) OVER () as p99
                FROM [{schema}].[{table}]
                WHERE [{column}] IS NOT NULL
            """
            percentiles_result = self.db.execute_query_dict(percentiles_query)
            percentiles = percentiles_result[0] if percentiles_result else {}
            
            # Detect outliers
            outliers = 0
            if outlier_method == 'iqr' and percentiles:
                q1 = percentiles.get('q1', 0)
                q3 = percentiles.get('q3', 0)
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                
                outliers_query = f"""
                    SELECT COUNT(*) as outlier_count
                    FROM [{schema}].[{table}]
                    WHERE [{column}] IS NOT NULL
                      AND ([{column}] < {lower_bound} OR [{column}] > {upper_bound})
                """
                outliers = self.db.execute_query_dict(outliers_query)[0]['outlier_count']
            elif outlier_method == 'zscore' and stats.get('std_dev'):
                mean = stats.get('mean_value', 0)
                std = stats.get('std_dev', 0)
                if std > 0:
                    outliers_query = f"""
                        SELECT COUNT(*) as outlier_count
                        FROM [{schema}].[{table}]
                        WHERE [{column}] IS NOT NULL
                          AND ABS(([{column}] - {mean}) / {std}) > 3
                    """
                    outliers = self.db.execute_query_dict(outliers_query)[0]['outlier_count']
            
            return {
                'profile_type': 'numeric',
                'min': float(stats['min_value']) if stats['min_value'] is not None else None,
                'max': float(stats['max_value']) if stats['max_value'] is not None else None,
                'mean': round(float(stats['mean_value']), 2) if stats['mean_value'] is not None else None,
                'std_dev': round(float(stats['std_dev']), 2) if stats['std_dev'] is not None else None,
                'median': float(percentiles.get('median', 0)) if percentiles.get('median') else None,
                'q1': float(percentiles.get('q1', 0)) if percentiles.get('q1') else None,
                'q3': float(percentiles.get('q3', 0)) if percentiles.get('q3') else None,
                'p95': float(percentiles.get('p95', 0)) if percentiles.get('p95') else None,
                'p99': float(percentiles.get('p99', 0)) if percentiles.get('p99') else None,
                'zero_count': stats['zero_count'],
                'negative_count': stats['negative_count'],
                'outliers_count': outliers,
                'outliers_percentage': round((outliers / total_rows) * 100, 2) if total_rows > 0 else 0
            }
        except Exception as e:
            return {
                'profile_type': 'numeric',
                'error': str(e)
            }
    
    def _profile_string_column(self, schema: str, table: str, column: str, total_rows: int, max_top_values: int) -> Dict:
        """Profile string column with patterns and distributions"""
        try:
            # Length statistics
            length_query = f"""
                SELECT 
                    MIN(LEN([{column}])) as min_length,
                    MAX(LEN([{column}])) as max_length,
                    AVG(LEN([{column}])) as avg_length
                FROM [{schema}].[{table}]
                WHERE [{column}] IS NOT NULL
            """
            length_stats = self.db.execute_query_dict(length_query)[0]
            
            # Empty strings and whitespace
            empty_query = f"""
                SELECT 
                    COUNT(CASE WHEN [{column}] = '' THEN 1 END) as empty_count,
                    COUNT(CASE WHEN [{column}] LIKE ' %' OR [{column}] LIKE '% ' THEN 1 END) as whitespace_count
                FROM [{schema}].[{table}]
            """
            empty_stats = self.db.execute_query_dict(empty_query)[0]
            
            # Top values
            top_values_query = f"""
                SELECT TOP {max_top_values}
                    [{column}] as value,
                    COUNT(*) as count,
                    CAST(COUNT(*) * 100.0 / {total_rows} AS DECIMAL(5,2)) as percentage
                FROM [{schema}].[{table}]
                WHERE [{column}] IS NOT NULL
                GROUP BY [{column}]
                ORDER BY COUNT(*) DESC
            """
            top_values = self.db.execute_query_dict(top_values_query)
            
            # Unique count
            unique_query = f"""
                SELECT COUNT(DISTINCT [{column}]) as unique_count
                FROM [{schema}].[{table}]
            """
            unique_count = self.db.execute_query_dict(unique_query)[0]['unique_count']
            
            return {
                'profile_type': 'string',
                'min_length': length_stats['min_length'],
                'max_length': length_stats['max_length'],
                'avg_length': round(float(length_stats['avg_length']), 1) if length_stats['avg_length'] else 0,
                'empty_strings': empty_stats['empty_count'],
                'with_whitespace': empty_stats['whitespace_count'],
                'unique_count': unique_count,
                'cardinality': round((unique_count / total_rows) * 100, 2) if total_rows > 0 else 0,
                'top_values': [
                    {
                        'value': str(row['value']),
                        'count': row['count'],
                        'percentage': float(row['percentage'])
                    }
                    for row in top_values
                ]
            }
        except Exception as e:
            return {
                'profile_type': 'string',
                'error': str(e)
            }
    
    def _profile_datetime_column(self, schema: str, table: str, column: str, total_rows: int) -> Dict:
        """Profile datetime column"""
        try:
            stats_query = f"""
                SELECT 
                    MIN([{column}]) as min_date,
                    MAX([{column}]) as max_date,
                    COUNT(CASE WHEN [{column}] > GETDATE() THEN 1 END) as future_dates
                FROM [{schema}].[{table}]
                WHERE [{column}] IS NOT NULL
            """
            stats = self.db.execute_query_dict(stats_query)[0]
            
            # Calculate date range in days
            if stats['min_date'] and stats['max_date']:
                min_date = stats['min_date']
                max_date = stats['max_date']
                if isinstance(min_date, str):
                    min_date = datetime.fromisoformat(min_date.replace('Z', '+00:00'))
                if isinstance(max_date, str):
                    max_date = datetime.fromisoformat(max_date.replace('Z', '+00:00'))
                
                date_range_days = (max_date - min_date).days
            else:
                date_range_days = 0
            
            return {
                'profile_type': 'datetime',
                'min_date': stats['min_date'].isoformat() if hasattr(stats['min_date'], 'isoformat') else str(stats['min_date']),
                'max_date': stats['max_date'].isoformat() if hasattr(stats['max_date'], 'isoformat') else str(stats['max_date']),
                'date_range_days': date_range_days,
                'future_dates': stats['future_dates']
            }
        except Exception as e:
            return {
                'profile_type': 'datetime',
                'error': str(e)
            }
    
    def _profile_boolean_column(self, schema: str, table: str, column: str, total_rows: int) -> Dict:
        """Profile boolean/bit column"""
        try:
            dist_query = f"""
                SELECT 
                    [{column}] as value,
                    COUNT(*) as count,
                    CAST(COUNT(*) * 100.0 / {total_rows} AS DECIMAL(5,2)) as percentage
                FROM [{schema}].[{table}]
                WHERE [{column}] IS NOT NULL
                GROUP BY [{column}]
                ORDER BY [{column}]
            """
            distribution = self.db.execute_query_dict(dist_query)
            
            return {
                'profile_type': 'boolean',
                'distribution': [
                    {
                        'value': bool(row['value']),
                        'count': row['count'],
                        'percentage': float(row['percentage'])
                    }
                    for row in distribution
                ]
            }
        except Exception as e:
            return {
                'profile_type': 'boolean',
                'error': str(e)
            }
    
    def _profile_common(self, schema: str, table: str, column: str, total_rows: int) -> Dict:
        """Common profiling metrics for all column types"""
        try:
            common_query = f"""
                SELECT 
                    COUNT(*) as non_null_count,
                    COUNT(CASE WHEN [{column}] IS NULL THEN 1 END) as null_count,
                    COUNT(DISTINCT [{column}]) as distinct_count
                FROM [{schema}].[{table}]
            """
            stats = self.db.execute_query_dict(common_query)[0]
            
            null_count = stats['null_count']
            distinct_count = stats['distinct_count']
            
            return {
                'total_values': total_rows,
                'null_count': null_count,
                'null_percentage': round((null_count / total_rows) * 100, 2) if total_rows > 0 else 0,
                'distinct_count': distinct_count,
                'distinct_percentage': round((distinct_count / total_rows) * 100, 2) if total_rows > 0 else 0,
                'completeness': round(((total_rows - null_count) / total_rows) * 100, 2) if total_rows > 0 else 0
            }
        except Exception as e:
            return {
                'error': str(e)
            }
    
    def _summarize_data_profiling(self, details: Dict) -> Dict:
        """Summarize data profiling results"""
        total_tables = len(details)
        tables_profiled = sum(1 for t in details.values() if t.get('status') == 'profiled')
        total_columns = sum(t.get('total_columns', 0) for t in details.values())
        
        return {
            'total_tables': total_tables,
            'tables_profiled': tables_profiled,
            'total_columns': total_columns
        }
