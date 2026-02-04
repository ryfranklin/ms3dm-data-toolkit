"""
Input validation utilities
"""
import re
from typing import Any, Dict, List, Tuple

def validate_sql_identifier(identifier: str) -> Tuple[bool, str]:
    """Validate SQL identifier (table name, column name, etc.)"""
    if not identifier:
        return False, "Identifier cannot be empty"
    
    # Basic SQL identifier validation
    # Allow alphanumeric, underscore, and dot (for schema.table)
    pattern = r'^[a-zA-Z_][a-zA-Z0-9_\.]*$'
    
    if not re.match(pattern, identifier):
        return False, "Invalid SQL identifier format"
    
    # Check for SQL injection patterns
    dangerous_keywords = ['DROP', 'DELETE', 'TRUNCATE', 'INSERT', 'UPDATE', '--', ';', 'EXEC', 'EXECUTE']
    upper_identifier = identifier.upper()
    
    for keyword in dangerous_keywords:
        if keyword in upper_identifier:
            return False, f"Potentially dangerous keyword detected: {keyword}"
    
    return True, "Valid"

def validate_connection_string(connection_string: str) -> Tuple[bool, str]:
    """Validate connection string format"""
    if not connection_string:
        return False, "Connection string cannot be empty"
    
    # Basic validation - check for required components
    required_keywords = ['Server=', 'Database=']
    
    for keyword in required_keywords:
        if keyword not in connection_string:
            return False, f"Missing required component: {keyword}"
    
    return True, "Valid"

def sanitize_table_name(table_name: str) -> str:
    """Sanitize table name for safe SQL usage"""
    # Remove any characters that aren't alphanumeric, underscore, or dot
    sanitized = re.sub(r'[^a-zA-Z0-9_\.]', '', table_name)
    return sanitized

def validate_check_types(check_types: List[str]) -> Tuple[bool, str]:
    """Validate quality check types"""
    valid_types = ['null_analysis', 'schema_validation', 'gap_detection', 'freshness']
    
    for check_type in check_types:
        if check_type not in valid_types:
            return False, f"Invalid check type: {check_type}. Valid types: {', '.join(valid_types)}"
    
    return True, "Valid"

def validate_port(port: Any) -> Tuple[bool, str]:
    """Validate port number"""
    try:
        port_int = int(port)
        if port_int < 1 or port_int > 65535:
            return False, "Port must be between 1 and 65535"
        return True, "Valid"
    except (ValueError, TypeError):
        return False, "Port must be a valid integer"
