"""
Database Connector
Handles SQL Server connections with both Windows and SQL authentication
"""
import pyodbc
from typing import Dict, List, Optional, Tuple, Any
import os

class DBConnector:
    """SQL Server database connector with support for multiple authentication types"""
    
    def __init__(self, connection_config: Dict):
        """
        Initialize database connector
        
        Args:
            connection_config: Connection configuration dictionary
        """
        self.config = connection_config
        self.connection = None
    
    def _build_connection_string(self) -> str:
        """Build ODBC connection string based on auth type"""
        server = self.config.get('server', 'localhost')
        database = self.config.get('database')
        auth_type = self.config.get('auth_type', 'windows')
        port = self.config.get('port', 1433)
        
        # Determine ODBC driver
        driver = '{ODBC Driver 18 for SQL Server}'
        
        # ODBC Driver 18 changed `Encrypt` default to `Mandatory`. In that
        # mode self-signed/internal-CA certs fail validation even with
        # `TrustServerCertificate=yes`. Setting `Encrypt=Optional` makes
        # encryption a negotiated preference, which lets internal SQL Servers
        # (the common case for this toolkit) connect cleanly.
        encryption = "Encrypt=Optional;TrustServerCertificate=yes;"

        # Build base connection string
        if auth_type == 'windows':
            # Windows Authentication
            conn_str = (
                f"DRIVER={driver};"
                f"SERVER={server};"
                f"DATABASE={database};"
                f"Trusted_Connection=yes;"
                f"{encryption}"
            )
        else:
            # SQL Server Authentication
            username = self.config.get('username', 'sa')
            password = self.config.get('password', '')

            conn_str = (
                f"DRIVER={driver};"
                f"SERVER={server},{port};"
                f"DATABASE={database};"
                f"UID={username};"
                f"PWD={password};"
                f"{encryption}"
            )

        return conn_str
    
    def connect(self) -> pyodbc.Connection:
        """
        Establish database connection
        
        Returns:
            pyodbc.Connection object
        """
        if self.connection is None or not self._is_connection_alive():
            conn_str = self._build_connection_string()
            try:
                self.connection = pyodbc.connect(conn_str, timeout=10)
            except pyodbc.Error as e:
                raise Exception(f"Failed to connect to database: {str(e)}")
        
        return self.connection
    
    def _is_connection_alive(self) -> bool:
        """Check if connection is still alive"""
        if self.connection is None:
            return False
        
        try:
            cursor = self.connection.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            return True
        except:
            return False
    
    def disconnect(self):
        """Close database connection"""
        if self.connection:
            try:
                self.connection.close()
            except:
                pass
            finally:
                self.connection = None
    
    def test_connection(self) -> Tuple[bool, str]:
        """
        Test database connection
        
        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            conn = self.connect()
            cursor = conn.cursor()
            cursor.execute("SELECT @@VERSION")
            version = cursor.fetchone()[0]
            cursor.close()
            
            return True, f"Connection successful. Server version: {version[:50]}..."
        except Exception as e:
            return False, f"Connection failed: {str(e)}"
    
    def execute_query(self, query: str, params: Optional[Tuple] = None) -> List[Tuple]:
        """
        Execute a SELECT query and return results
        
        Args:
            query: SQL query string
            params: Optional query parameters
            
        Returns:
            List of result tuples
        """
        try:
            conn = self.connect()
            cursor = conn.cursor()
            
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            results = cursor.fetchall()
            cursor.close()
            
            return results
        except Exception as e:
            raise Exception(f"Query execution failed: {str(e)}")
    
    def execute_query_dict(self, query: str, params: Optional[Tuple] = None) -> List[Dict]:
        """
        Execute a SELECT query and return results as list of dictionaries
        
        Args:
            query: SQL query string
            params: Optional query parameters
            
        Returns:
            List of result dictionaries
        """
        try:
            conn = self.connect()
            cursor = conn.cursor()
            
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            # Get column names
            columns = [column[0] for column in cursor.description]
            
            # Fetch results and convert to dictionaries
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
            
            cursor.close()
            
            return results
        except Exception as e:
            raise Exception(f"Query execution failed: {str(e)}")
    
    def get_schema_metadata(self) -> Dict:
        """
        Get database schema metadata (tables, views, stored procedures)
        
        Returns:
            Dictionary with schema metadata
        """
        try:
            conn = self.connect()
            
            # Get tables
            tables_query = """
                SELECT 
                    TABLE_SCHEMA,
                    TABLE_NAME,
                    TABLE_TYPE
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
                ORDER BY TABLE_SCHEMA, TABLE_NAME
            """
            tables = self.execute_query_dict(tables_query)
            
            # Get stored procedures
            procs_query = """
                SELECT 
                    ROUTINE_SCHEMA,
                    ROUTINE_NAME,
                    ROUTINE_TYPE
                FROM INFORMATION_SCHEMA.ROUTINES
                WHERE ROUTINE_TYPE = 'PROCEDURE'
                ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME
            """
            procedures = self.execute_query_dict(procs_query)
            
            # Organize by schema
            schemas = {}
            
            for table in tables:
                schema_name = table['TABLE_SCHEMA']
                if schema_name not in schemas:
                    schemas[schema_name] = {
                        'tables': [],
                        'views': [],
                        'procedures': []
                    }
                
                if table['TABLE_TYPE'] == 'BASE TABLE':
                    schemas[schema_name]['tables'].append(table['TABLE_NAME'])
                else:
                    schemas[schema_name]['views'].append(table['TABLE_NAME'])
            
            for proc in procedures:
                schema_name = proc['ROUTINE_SCHEMA']
                if schema_name not in schemas:
                    schemas[schema_name] = {
                        'tables': [],
                        'views': [],
                        'procedures': []
                    }
                schemas[schema_name]['procedures'].append(proc['ROUTINE_NAME'])
            
            return {
                'database': self.config.get('database'),
                'schemas': schemas
            }
            
        except Exception as e:
            raise Exception(f"Failed to retrieve schema metadata: {str(e)}")
    
    def get_object_metadata(self, schema_name: str, object_name: str) -> Dict:
        """
        Get detailed metadata for a specific database object
        
        Args:
            schema_name: Schema name
            object_name: Object name (table, view, etc.)
            
        Returns:
            Dictionary with object metadata
        """
        try:
            # Get columns
            columns_query = """
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE,
                    CHARACTER_MAXIMUM_LENGTH,
                    NUMERIC_PRECISION,
                    NUMERIC_SCALE,
                    COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
            """
            columns = self.execute_query_dict(columns_query, (schema_name, object_name))
            
            # Get row count (for tables only)
            row_count = None
            try:
                count_query = f"SELECT COUNT(*) as cnt FROM [{schema_name}].[{object_name}]"
                count_result = self.execute_query_dict(count_query)
                if count_result:
                    row_count = count_result[0]['cnt']
            except:
                pass  # Might fail for views or if object doesn't exist
            
            # Get primary keys
            pk_query = """
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
                AND TABLE_SCHEMA = ? AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
            """
            primary_keys = self.execute_query_dict(pk_query, (schema_name, object_name))
            pk_columns = [pk['COLUMN_NAME'] for pk in primary_keys]
            
            # Get foreign keys
            fk_query = """
                SELECT 
                    fk.name AS FK_NAME,
                    COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS COLUMN_NAME,
                    OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS REFERENCED_SCHEMA,
                    OBJECT_NAME(fk.referenced_object_id) AS REFERENCED_TABLE,
                    COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS REFERENCED_COLUMN
                FROM sys.foreign_keys AS fk
                INNER JOIN sys.foreign_key_columns AS fkc 
                    ON fk.object_id = fkc.constraint_object_id
                WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id) = ?
                AND OBJECT_NAME(fk.parent_object_id) = ?
            """
            foreign_keys = self.execute_query_dict(fk_query, (schema_name, object_name))
            
            return {
                'schema': schema_name,
                'name': object_name,
                'columns': columns,
                'row_count': row_count,
                'primary_keys': pk_columns,
                'foreign_keys': foreign_keys
            }
            
        except Exception as e:
            raise Exception(f"Failed to retrieve object metadata: {str(e)}")
    
    def get_foreign_key_relationships(self) -> List[Dict]:
        """
        Get all foreign key relationships in the database
        
        Returns:
            List of foreign key relationship dictionaries
        """
        try:
            fk_query = """
                SELECT 
                    OBJECT_SCHEMA_NAME(fk.parent_object_id) AS SOURCE_SCHEMA,
                    OBJECT_NAME(fk.parent_object_id) AS SOURCE_TABLE,
                    COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS SOURCE_COLUMN,
                    OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS TARGET_SCHEMA,
                    OBJECT_NAME(fk.referenced_object_id) AS TARGET_TABLE,
                    COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS TARGET_COLUMN,
                    fk.name AS CONSTRAINT_NAME
                FROM sys.foreign_keys AS fk
                INNER JOIN sys.foreign_key_columns AS fkc 
                    ON fk.object_id = fkc.constraint_object_id
                ORDER BY SOURCE_SCHEMA, SOURCE_TABLE
            """
            
            relationships = self.execute_query_dict(fk_query)
            return relationships
            
        except Exception as e:
            raise Exception(f"Failed to retrieve foreign key relationships: {str(e)}")
    
    def __enter__(self):
        """Context manager entry"""
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.disconnect()
