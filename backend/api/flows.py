"""
Data Flow API endpoints
Manage and visualize data flows
"""
from flask import Blueprint, request, jsonify
from services.flow_analyzer import FlowAnalyzer
from services.db_connector import DBConnector
from services.sql_parser import SQLParser
from utils.config_manager import ConfigManager
import os
import yaml

flows_bp = Blueprint('flows', __name__)
config_manager = ConfigManager()

def get_flows_file():
    """Get the path to the flows YAML file"""
    flows_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'flows')
    os.makedirs(flows_dir, exist_ok=True)
    return os.path.join(flows_dir, 'data_flows.yaml')

@flows_bp.route('/', methods=['GET'])
def get_flows():
    """List all documented flows"""
    try:
        flows_file = get_flows_file()
        
        if not os.path.exists(flows_file):
            return jsonify({'flows': []}), 200
        
        with open(flows_file, 'r') as f:
            data = yaml.safe_load(f) or {}
        
        flows = data.get('flows', [])
        return jsonify({'flows': flows}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@flows_bp.route('/', methods=['POST'])
def create_flow():
    """Create new flow from canvas JSON"""
    try:
        data = request.json
        
        flows_file = get_flows_file()
        
        # Load existing flows
        if os.path.exists(flows_file):
            with open(flows_file, 'r') as f:
                flows_data = yaml.safe_load(f) or {}
        else:
            flows_data = {'flows': []}
        
        # Convert canvas JSON to YAML format
        analyzer = FlowAnalyzer(None)
        flow_yaml = analyzer.canvas_to_yaml(data)
        
        # Add to flows list
        if 'flows' not in flows_data:
            flows_data['flows'] = []
        flows_data['flows'].append(flow_yaml)
        
        # Save to file
        with open(flows_file, 'w') as f:
            yaml.dump(flows_data, f, default_flow_style=False, sort_keys=False)
        
        return jsonify({
            'message': 'Flow created successfully',
            'flow_id': flow_yaml['id']
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@flows_bp.route('/<flow_id>', methods=['GET'])
def get_flow(flow_id):
    """Get flow by ID and return as React Flow nodes/edges"""
    try:
        flows_file = get_flows_file()
        
        if not os.path.exists(flows_file):
            return jsonify({'error': 'Flow not found'}), 404
        
        with open(flows_file, 'r') as f:
            data = yaml.safe_load(f) or {}
        
        flows = data.get('flows', [])
        flow = next((f for f in flows if f['id'] == flow_id), None)
        
        if not flow:
            return jsonify({'error': 'Flow not found'}), 404
        
        # Convert YAML to React Flow format
        analyzer = FlowAnalyzer(None)
        canvas_data = analyzer.yaml_to_canvas(flow)
        
        return jsonify(canvas_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@flows_bp.route('/<flow_id>', methods=['PUT'])
def update_flow(flow_id):
    """Update flow"""
    try:
        data = request.json
        flows_file = get_flows_file()
        
        if not os.path.exists(flows_file):
            return jsonify({'error': 'Flow not found'}), 404
        
        with open(flows_file, 'r') as f:
            flows_data = yaml.safe_load(f) or {}
        
        flows = flows_data.get('flows', [])
        flow_index = next((i for i, f in enumerate(flows) if f['id'] == flow_id), None)
        
        if flow_index is None:
            return jsonify({'error': 'Flow not found'}), 404
        
        # Convert canvas JSON to YAML format
        analyzer = FlowAnalyzer(None)
        flow_yaml = analyzer.canvas_to_yaml(data)
        flow_yaml['id'] = flow_id  # Preserve ID
        
        flows[flow_index] = flow_yaml
        flows_data['flows'] = flows
        
        with open(flows_file, 'w') as f:
            yaml.dump(flows_data, f, default_flow_style=False, sort_keys=False)
        
        return jsonify({'message': 'Flow updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@flows_bp.route('/<flow_id>', methods=['DELETE'])
def delete_flow(flow_id):
    """Delete flow"""
    try:
        flows_file = get_flows_file()
        
        if not os.path.exists(flows_file):
            return jsonify({'error': 'Flow not found'}), 404
        
        with open(flows_file, 'r') as f:
            flows_data = yaml.safe_load(f) or {}
        
        flows = flows_data.get('flows', [])
        flows = [f for f in flows if f['id'] != flow_id]
        
        flows_data['flows'] = flows
        
        with open(flows_file, 'w') as f:
            yaml.dump(flows_data, f, default_flow_style=False, sort_keys=False)
        
        return jsonify({'message': 'Flow deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@flows_bp.route('/<flow_id>/lineage', methods=['GET'])
def get_lineage(flow_id):
    """Get lineage graph for a flow"""
    try:
        flows_file = get_flows_file()
        
        if not os.path.exists(flows_file):
            return jsonify({'error': 'Flow not found'}), 404
        
        with open(flows_file, 'r') as f:
            data = yaml.safe_load(f) or {}
        
        flows = data.get('flows', [])
        flow = next((f for f in flows if f['id'] == flow_id), None)
        
        if not flow:
            return jsonify({'error': 'Flow not found'}), 404
        
        analyzer = FlowAnalyzer(None)
        lineage = analyzer.generate_lineage(flow)
        
        return jsonify(lineage), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@flows_bp.route('/discover', methods=['POST'])
def discover_relationships():
    """Auto-discover database relationships"""
    try:
        data = request.json
        connection_id = data.get('connection_id')
        
        if not connection_id:
            return jsonify({'error': 'connection_id is required'}), 400
        
        connection = config_manager.get_connection(connection_id)
        if not connection:
            return jsonify({'error': 'Connection not found'}), 404
        
        db_connector = DBConnector(connection)
        analyzer = FlowAnalyzer(db_connector)
        
        relationships = analyzer.discover_relationships()
        
        return jsonify(relationships), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@flows_bp.route('/schema/<connection_id>', methods=['GET'])
def browse_schema(connection_id):
    """Browse database schema"""
    try:
        connection = config_manager.get_connection(connection_id)
        if not connection:
            return jsonify({'error': 'Connection not found'}), 404
        
        db_connector = DBConnector(connection)
        schema = db_connector.get_schema_metadata()
        
        return jsonify(schema), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@flows_bp.route('/schema/<connection_id>/metadata/<schema_name>/<object_name>', methods=['GET'])
def get_object_metadata(connection_id, schema_name, object_name):
    """Get detailed object metadata"""
    try:
        connection = config_manager.get_connection(connection_id)
        if not connection:
            return jsonify({'error': 'Connection not found'}), 404
        
        db_connector = DBConnector(connection)
        metadata = db_connector.get_object_metadata(schema_name, object_name)
        
        return jsonify(metadata), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@flows_bp.route('/parse-sql', methods=['POST'])
def parse_sql():
    """Parse SQL code and return diagram data"""
    try:
        data = request.json
        sql_code = data.get('sql_code', '')
        
        if not sql_code:
            return jsonify({'error': 'sql_code is required'}), 400
        
        parser = SQLParser()
        result = parser.parse(sql_code)
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
