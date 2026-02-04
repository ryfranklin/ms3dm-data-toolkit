"""
Expectations API endpoints
Manage and execute data quality checks
"""
from flask import Blueprint, request, jsonify
from services.expectation_engine import ExpectationEngine
import os
import json
import uuid
from datetime import datetime

expectations_bp = Blueprint('expectations', __name__)
engine = ExpectationEngine()

# Results directory
RESULTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'expectations_results')
os.makedirs(RESULTS_DIR, exist_ok=True)


@expectations_bp.route('/library', methods=['GET'])
def get_library():
    """Get catalog of available expectation types"""
    library = engine.get_expectation_library()
    return jsonify(library), 200


@expectations_bp.route('/validate', methods=['POST'])
def validate_single():
    """Validate single expectation (for testing)"""
    try:
        data = request.json
        result = engine.validate_expectation(
            connection_id=data['connection_id'],
            expectation=data['expectation']
        )
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expectations_bp.route('/run-adhoc', methods=['POST'])
def run_adhoc():
    """Run expectations without saving (for testing)"""
    try:
        data = request.json
        
        # Create temporary suite
        suite = {
            'suite_id': f'adhoc_{uuid.uuid4().hex[:8]}',
            'name': data.get('name', 'Ad-hoc Validation'),
            'connection_id': data['connection_id'],
            'expectations': data['expectations']
        }
        
        # Execute
        result = engine.run_suite(suite)
        
        # Save result to file
        result_id = result['result_id']
        result_file = os.path.join(RESULTS_DIR, f'{result_id}.json')
        with open(result_file, 'w') as f:
            json.dump(result, f, indent=2)
        
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expectations_bp.route('/results', methods=['GET'])
def get_results_history():
    """Get history of all expectation executions"""
    try:
        results = []
        
        if os.path.exists(RESULTS_DIR):
            for filename in sorted(os.listdir(RESULTS_DIR), reverse=True):
                if filename.endswith('.json'):
                    filepath = os.path.join(RESULTS_DIR, filename)
                    try:
                        with open(filepath, 'r') as f:
                            result = json.load(f)
                            # Return summary only
                            results.append({
                                'result_id': result.get('result_id'),
                                'suite_name': result.get('suite_name'),
                                'execution_time': result.get('execution_time'),
                                'duration_seconds': result.get('duration_seconds'),
                                'status': result.get('status'),
                                'statistics': result.get('statistics')
                            })
                    except Exception as e:
                        print(f"Error reading {filename}: {e}")
                        continue
        
        return jsonify({'results': results}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expectations_bp.route('/results/<result_id>', methods=['GET'])
def get_result_detail(result_id):
    """Get detailed results for a specific execution"""
    try:
        result_file = os.path.join(RESULTS_DIR, f'{result_id}.json')
        
        if not os.path.exists(result_file):
            return jsonify({'error': 'Result not found'}), 404
        
        with open(result_file, 'r') as f:
            result = json.load(f)
        
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expectations_bp.route('/table-schema', methods=['POST'])
def get_table_schema():
    """Get SQL schema for a table"""
    try:
        data = request.json
        connection_id = data.get('connection_id')
        schema = data.get('schema', 'dbo')
        table = data.get('table')
        
        if not connection_id or not table:
            return jsonify({'error': 'connection_id and table are required'}), 400
        
        # Get table schema SQL
        schema_info = engine.get_table_schema(connection_id, schema, table)
        
        return jsonify(schema_info), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expectations_bp.route('/available-tables', methods=['POST'])
def get_available_tables():
    """Get list of schemas and tables from database"""
    try:
        data = request.json
        connection_id = data.get('connection_id')
        
        if not connection_id:
            return jsonify({'error': 'connection_id is required'}), 400
        
        # Get available tables
        tables_info = engine.get_available_tables(connection_id)
        
        return jsonify(tables_info), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expectations_bp.route('/suites', methods=['GET'])
def list_suites():
    """List all saved expectation suites"""
    try:
        # For now, return empty list
        # TODO: Implement suite storage/loading from files or database
        suites = []
        
        # Optional: You could scan the dags directory for suite references
        # or create a dedicated suites directory for saved configurations
        
        return jsonify(suites), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
