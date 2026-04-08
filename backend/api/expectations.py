"""
Expectations API endpoints
Manage and execute data quality checks
"""
from flask import Blueprint, request, jsonify, current_app
from services.expectation_engine import ExpectationEngine
import uuid
from datetime import datetime

expectations_bp = Blueprint('expectations', __name__)


def _store():
    return current_app.config['METADATA_STORE']


def _engine():
    return ExpectationEngine(store=_store())


@expectations_bp.route('/library', methods=['GET'])
def get_library():
    """Get catalog of available expectation types"""
    engine = _engine()
    library = engine.get_expectation_library()
    return jsonify(library), 200


@expectations_bp.route('/validate', methods=['POST'])
def validate_single():
    """Validate single expectation (for testing)"""
    try:
        data = request.json
        engine = _engine()
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
        engine = _engine()

        # Create temporary suite
        suite = {
            'suite_id': f'adhoc_{uuid.uuid4().hex[:8]}',
            'name': data.get('name', 'Ad-hoc Validation'),
            'connection_id': data['connection_id'],
            'expectations': data['expectations']
        }

        # Execute
        result = engine.run_suite(suite)

        # Save result to SQL
        result['connection_id'] = data['connection_id']
        _store().save_expectation_result(result)

        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expectations_bp.route('/results', methods=['GET'])
def get_results_history():
    """Get history of all expectation executions"""
    try:
        results = _store().get_expectation_history()
        return jsonify({'results': results}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expectations_bp.route('/results/<result_id>', methods=['GET'])
def get_result_detail(result_id):
    """Get detailed results for a specific execution"""
    try:
        result = _store().get_expectation_result(result_id)

        if not result:
            return jsonify({'error': 'Result not found'}), 404

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

        engine = _engine()
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

        engine = _engine()
        tables_info = engine.get_available_tables(connection_id)

        return jsonify(tables_info), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@expectations_bp.route('/suites', methods=['GET'])
def list_suites():
    """List all saved expectation suites"""
    try:
        suites = []
        return jsonify(suites), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
