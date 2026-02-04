"""
Configuration Manager
Handles reading and writing connection configurations from YAML files
"""
import os
import yaml
import uuid
from typing import Dict, List, Optional

class ConfigManager:
    """Manage SQL Server connection configurations"""
    
    def __init__(self, config_dir: Optional[str] = None):
        """Initialize the configuration manager"""
        if config_dir is None:
            # Default to ../config relative to backend directory
            backend_dir = os.path.dirname(os.path.dirname(__file__))
            self.config_dir = os.path.join(backend_dir, 'config')
        else:
            self.config_dir = config_dir
        
        self.config_file = os.path.join(self.config_dir, 'connections.yaml')
        
        # Ensure config directory exists
        os.makedirs(self.config_dir, exist_ok=True)
        
        # Initialize config file if it doesn't exist
        if not os.path.exists(self.config_file):
            self._initialize_config()
    
    def _initialize_config(self):
        """Create initial config file"""
        initial_config = {'connections': []}
        with open(self.config_file, 'w') as f:
            yaml.dump(initial_config, f, default_flow_style=False)
    
    def _load_config(self) -> Dict:
        """Load configuration from YAML file"""
        try:
            with open(self.config_file, 'r') as f:
                config = yaml.safe_load(f) or {}
            return config
        except Exception as e:
            raise Exception(f"Failed to load configuration: {str(e)}")
    
    def _save_config(self, config: Dict):
        """Save configuration to YAML file"""
        try:
            with open(self.config_file, 'w') as f:
                yaml.dump(config, f, default_flow_style=False, sort_keys=False)
        except Exception as e:
            raise Exception(f"Failed to save configuration: {str(e)}")
    
    def get_all_connections(self) -> List[Dict]:
        """Get all configured connections"""
        config = self._load_config()
        return config.get('connections', [])
    
    def get_connection(self, connection_id: str) -> Optional[Dict]:
        """Get a specific connection by ID"""
        connections = self.get_all_connections()
        return next((conn for conn in connections if conn['id'] == connection_id), None)
    
    def add_connection(self, connection_data: Dict) -> str:
        """Add a new connection"""
        # Validate required fields
        required_fields = ['name', 'server', 'database', 'auth_type']
        for field in required_fields:
            if field not in connection_data:
                raise ValueError(f"Missing required field: {field}")
        
        # Generate ID if not provided
        if 'id' not in connection_data:
            connection_data['id'] = str(uuid.uuid4())
        
        # Set defaults
        connection_data.setdefault('active', True)
        connection_data.setdefault('is_sample', False)
        
        # Validate auth_type
        if connection_data['auth_type'] not in ['windows', 'sql_auth']:
            raise ValueError("auth_type must be 'windows' or 'sql_auth'")
        
        # Check for SQL auth credentials
        if connection_data['auth_type'] == 'sql_auth':
            if 'username' not in connection_data or 'password' not in connection_data:
                raise ValueError("username and password required for sql_auth")
        
        # Load config and add connection
        config = self._load_config()
        if 'connections' not in config:
            config['connections'] = []
        
        # Check for duplicate ID
        existing_ids = [conn['id'] for conn in config['connections']]
        if connection_data['id'] in existing_ids:
            raise ValueError(f"Connection with ID {connection_data['id']} already exists")
        
        config['connections'].append(connection_data)
        self._save_config(config)
        
        return connection_data['id']
    
    def update_connection(self, connection_id: str, update_data: Dict):
        """Update an existing connection"""
        config = self._load_config()
        connections = config.get('connections', [])
        
        # Find connection index
        conn_index = next((i for i, conn in enumerate(connections) if conn['id'] == connection_id), None)
        
        if conn_index is None:
            raise ValueError(f"Connection with ID {connection_id} not found")
        
        # Update connection (preserve ID)
        update_data['id'] = connection_id
        connections[conn_index].update(update_data)
        
        config['connections'] = connections
        self._save_config(config)
    
    def delete_connection(self, connection_id: str):
        """Delete a connection"""
        config = self._load_config()
        connections = config.get('connections', [])
        
        # Filter out the connection to delete
        initial_count = len(connections)
        connections = [conn for conn in connections if conn['id'] != connection_id]
        
        if len(connections) == initial_count:
            raise ValueError(f"Connection with ID {connection_id} not found")
        
        config['connections'] = connections
        self._save_config(config)
    
    def validate_connection(self, connection_data: Dict) -> tuple[bool, str]:
        """Validate connection data structure"""
        required_fields = ['name', 'server', 'database', 'auth_type']
        
        for field in required_fields:
            if field not in connection_data:
                return False, f"Missing required field: {field}"
        
        if connection_data['auth_type'] not in ['windows', 'sql_auth']:
            return False, "auth_type must be 'windows' or 'sql_auth'"
        
        if connection_data['auth_type'] == 'sql_auth':
            if 'username' not in connection_data or 'password' not in connection_data:
                return False, "username and password required for sql_auth"
        
        return True, "Valid"
