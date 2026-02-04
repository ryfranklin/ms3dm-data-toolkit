"""
Data Quality API endpoints
Execute and retrieve data quality checks
"""
from flask import Blueprint, request, jsonify
from services.quality_checker import QualityChecker
from utils.config_manager import ConfigManager
import uuid
import json
import os
from datetime import datetime

quality_bp = Blueprint('quality', __name__)
config_manager = ConfigManager()

@quality_bp.route('/run-checks', methods=['POST'])
def run_checks():
    """Execute data quality checks on-demand"""
    try:
        data = request.json
        connection_id = data.get('connection_id')
        check_types = data.get('check_types', [])
        tables = data.get('tables', [])
        config = data.get('config', {})
        
        if not connection_id:
            return jsonify({'error': 'connection_id is required'}), 400
        
        connection = config_manager.get_connection(connection_id)
        if not connection:
            return jsonify({'error': 'Connection not found'}), 404
        
        # Create quality checker instance
        checker = QualityChecker(connection)
        
        # Run checks
        results = checker.run_checks(check_types, tables, config)
        
        # Save results
        check_id = str(uuid.uuid4())
        results['check_id'] = check_id
        results['timestamp'] = datetime.utcnow().isoformat()
        results['connection_id'] = connection_id
        
        results_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'results')
        os.makedirs(results_dir, exist_ok=True)
        
        results_file = os.path.join(results_dir, f'{check_id}.json')
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        return jsonify({
            'check_id': check_id,
            'message': 'Checks completed successfully',
            'summary': results.get('summary', {})
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quality_bp.route('/results/<check_id>', methods=['GET'])
def get_results(check_id):
    """Retrieve check results by ID"""
    try:
        results_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'results')
        results_file = os.path.join(results_dir, f'{check_id}.json')
        
        if not os.path.exists(results_file):
            return jsonify({'error': 'Results not found'}), 404
        
        with open(results_file, 'r') as f:
            results = json.load(f)
        
        return jsonify(results), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quality_bp.route('/history', methods=['GET'])
def get_history():
    """List previous check runs"""
    try:
        results_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'results')
        
        if not os.path.exists(results_dir):
            return jsonify({'history': []}), 200
        
        history = []
        for filename in os.listdir(results_dir):
            if filename.endswith('.json'):
                file_path = os.path.join(results_dir, filename)
                with open(file_path, 'r') as f:
                    results = json.load(f)
                    history.append({
                        'check_id': results.get('check_id'),
                        'timestamp': results.get('timestamp'),
                        'connection_id': results.get('connection_id'),
                        'summary': results.get('summary', {})
                    })
        
        # Sort by timestamp descending
        history.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        return jsonify({'history': history}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quality_bp.route('/generate-config/<connection_id>', methods=['GET'])
def generate_config(connection_id):
    """Generate configuration from database INFORMATION_SCHEMA"""
    try:
        connection = config_manager.get_connection(connection_id)
        if not connection:
            return jsonify({'error': 'Connection not found'}), 404
        
        checker = QualityChecker(connection)
        
        # Get all tables
        tables_query = """
            SELECT TABLE_SCHEMA, TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_SCHEMA, TABLE_NAME
        """
        tables = checker.db.execute_query_dict(tables_query)
        
        config = {
            'expected_schema': {},
            'sequence_columns': {},
            'freshness_columns': {},
            'null_threshold': 0.1,
            'freshness_threshold_hours': 24
        }
        
        for table in tables:
            schema = table['TABLE_SCHEMA']
            table_name = table['TABLE_NAME']
            full_table_name = f"{schema}.{table_name}"
            
            # Get columns with types
            columns_query = """
                SELECT 
                    c.COLUMN_NAME, 
                    c.DATA_TYPE, 
                    c.IS_NULLABLE,
                    COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') as IS_IDENTITY
                FROM INFORMATION_SCHEMA.COLUMNS c
                WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
                ORDER BY c.ORDINAL_POSITION
            """
            columns = checker.db.execute_query_dict(columns_query, (schema, table_name))
            
            # Build expected schema
            config['expected_schema'][full_table_name] = {}
            sequence_cols = []
            freshness_cols = {}
            
            for col in columns:
                col_name = col['COLUMN_NAME']
                data_type = col['DATA_TYPE']
                is_identity = col.get('IS_IDENTITY', 0)
                
                # Add to expected schema
                config['expected_schema'][full_table_name][col_name] = {
                    'type': data_type
                }
                
                # Auto-detect sequence columns (IDENTITY columns)
                if is_identity == 1:
                    sequence_cols.append(col_name)
                
                # Auto-detect datetime columns for freshness
                if data_type in ['datetime', 'datetime2', 'date', 'smalldatetime', 'timestamp']:
                    # Set default threshold of 24 hours for datetime columns
                    freshness_cols[col_name] = 24
            
            # Add sequence columns if any found
            if sequence_cols:
                config['sequence_columns'][full_table_name] = sequence_cols
            
            # Add freshness columns if any found
            if freshness_cols:
                config['freshness_columns'][full_table_name] = freshness_cols
        
        return jsonify({'config': config}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quality_bp.route('/save-config', methods=['POST'])
def save_config():
    """Save quality check configuration"""
    try:
        data = request.json
        connection_id = data.get('connection_id')
        config_data = data.get('config', {})
        
        if not connection_id:
            return jsonify({'error': 'connection_id is required'}), 400
        
        # Save to config directory
        config_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config')
        os.makedirs(config_dir, exist_ok=True)
        
        config_file = os.path.join(config_dir, f'quality_config_{connection_id}.json')
        with open(config_file, 'w') as f:
            json.dump(config_data, f, indent=2)
        
        return jsonify({'message': 'Configuration saved successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quality_bp.route('/load-config/<connection_id>', methods=['GET'])
def load_config(connection_id):
    """Load saved quality check configuration"""
    try:
        config_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config')
        config_file = os.path.join(config_dir, f'quality_config_{connection_id}.json')
        
        if not os.path.exists(config_file):
            return jsonify({'config': None}), 200
        
        with open(config_file, 'r') as f:
            config_data = json.load(f)
        
        return jsonify({'config': config_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
