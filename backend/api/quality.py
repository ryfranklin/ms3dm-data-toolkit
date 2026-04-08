"""
Data Quality API endpoints
Execute and retrieve data quality checks
"""
from flask import Blueprint, request, jsonify, current_app
from services.quality_checker import QualityChecker
import uuid
import json
import os
import yaml
import re
from datetime import datetime

quality_bp = Blueprint('quality', __name__)


def _store():
    return current_app.config['METADATA_STORE']


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

        connection = _store().get_connection(connection_id)
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

        _store().save_quality_result(results)

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
        results = _store().get_quality_result(check_id)

        if not results:
            return jsonify({'error': 'Results not found'}), 404

        return jsonify(results), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quality_bp.route('/history', methods=['GET'])
def get_history():
    """List previous check runs"""
    try:
        history = _store().get_quality_history()
        return jsonify({'history': history}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quality_bp.route('/generate-config/<connection_id>', methods=['GET'])
def generate_config(connection_id):
    """Generate configuration from database INFORMATION_SCHEMA"""
    try:
        connection = _store().get_connection(connection_id)
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

        _store().save_quality_config(connection_id, config_data)

        return jsonify({'message': 'Configuration saved successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quality_bp.route('/load-config/<connection_id>', methods=['GET'])
def load_config(connection_id):
    """Load saved quality check configuration"""
    try:
        config_data = _store().get_quality_config(connection_id)
        return jsonify({'config': config_data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@quality_bp.route('/available-checks', methods=['GET'])
def get_available_checks():
    """Get list of available quality check types"""
    try:
        checks = [
            {
                'id': 'not_null',
                'name': 'Not Null',
                'description': 'Column values must not be null',
                'category': 'completeness'
            },
            {
                'id': 'unique',
                'name': 'Unique Values',
                'description': 'Column values must be unique',
                'category': 'uniqueness'
            },
            {
                'id': 'value_range',
                'name': 'Value Range',
                'description': 'Numeric values must be within expected range',
                'category': 'validity'
            },
            {
                'id': 'value_set',
                'name': 'Value Set',
                'description': 'Values must be in allowed set of values',
                'category': 'validity'
            },
            {
                'id': 'row_count',
                'name': 'Row Count',
                'description': 'Table must have expected row count range',
                'category': 'volume'
            },
            {
                'id': 'freshness',
                'name': 'Data Freshness',
                'description': 'Data must be updated within expected time window',
                'category': 'timeliness'
            },
            {
                'id': 'referential_integrity',
                'name': 'Referential Integrity',
                'description': 'Foreign key references must exist',
                'category': 'consistency'
            },
            {
                'id': 'pattern',
                'name': 'Pattern Match',
                'description': 'Values must match expected pattern (regex)',
                'category': 'validity'
            }
        ]

        return jsonify(checks), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@quality_bp.route('/pipeline', methods=['POST'])
def create_pipeline():
    """Create a data quality pipeline as a Dagu workflow"""
    try:
        data = request.json
        pipeline_name = data.get('name', '').strip()
        pipeline_description = data.get('description', '').strip()
        steps = data.get('steps', [])

        if not pipeline_name:
            return jsonify({'error': 'Pipeline name is required'}), 400

        if not steps or len(steps) == 0:
            return jsonify({'error': 'At least one step is required'}), 400

        # Sanitize pipeline name for filename
        dag_filename = re.sub(r'[^a-z0-9_]+', '_', pipeline_name.lower())
        dag_filename = f'{dag_filename}_quality_pipeline.yaml'

        # Build Dagu workflow YAML
        workflow = {
            'name': f'{pipeline_name} - Quality Pipeline',
            'description': pipeline_description or 'Automated data quality checks',
            'schedule': '',  # Manual trigger by default
            'params': 'RETENTION_DAYS=30',
            'steps': []
        }

        # Build steps
        for step in steps:
            step_name = step.get('name', f"Step {step.get('order')}")
            connection_id = step.get('connection_id')
            schema = step.get('schema')
            table = step.get('table')
            checks = step.get('checks', [])
            on_failure = step.get('on_failure', 'continue')

            # Create step command
            checks_list = ','.join(checks)

            step_def = {
                'name': re.sub(r'[^a-z0-9_]+', '_', step_name.lower()),
                'description': f'Run quality checks on {schema}.{table}',
                'command': f'''
echo "=== {step_name} ==="
echo "Table: {schema}.{table}"
echo "Checks: {checks_list}"
echo ""

# Call quality check API
RESPONSE=$(curl -s -X POST http://backend:8000/api/quality/run-checks \\
  -H "Content-Type: application/json" \\
  -d '{{"connection_id": "{connection_id}", "schema": "{schema}", "table": "{table}", "checks": ["{','.join([f'"{c}"' for c in checks])}"]}}')

# Check if successful
if echo "$RESPONSE" | jq -e '.check_id' > /dev/null 2>&1; then
  echo "Quality checks passed!"
  CHECK_ID=$(echo "$RESPONSE" | jq -r '.check_id')
  echo "Check ID: $CHECK_ID"
  echo ""
  echo "$RESPONSE" | jq -r '.summary'
else
  echo "Quality checks failed:"
  echo "$RESPONSE" | jq -r '.error // .message'
  {"exit 1" if on_failure == "stop" else "echo 'Continuing despite failure...'"}
fi
'''.strip()
            }

            # Add dependencies (each step depends on previous one)
            if len(workflow['steps']) > 0:
                step_def['depends'] = [workflow['steps'][-1]['name']]

            workflow['steps'].append(step_def)

        # Add final summary step
        workflow['steps'].append({
            'name': 'pipeline_summary',
            'description': 'Display pipeline completion summary',
            'command': '''
echo ""
echo "=========================================="
echo "Pipeline completed successfully!"
echo "=========================================="
echo ""
echo "All quality checks have been executed."
echo "Check Dagu logs for detailed results."
'''.strip(),
            'depends': [workflow['steps'][-1]['name']] if workflow['steps'] else []
        })

        # Save DAG file (stays on disk - Dagu reads from filesystem)
        dags_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dags')
        os.makedirs(dags_dir, exist_ok=True)

        dag_path = os.path.join(dags_dir, dag_filename)
        with open(dag_path, 'w') as f:
            yaml.dump(workflow, f, default_flow_style=False, sort_keys=False)

        return jsonify({
            'message': 'Pipeline created successfully',
            'pipeline_name': pipeline_name,
            'dag_file': dag_filename,
            'dag_path': dag_path,
            'dagu_url': f'http://localhost:8080/dags/{dag_filename.replace(".yaml", "")}'
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@quality_bp.route('/pipelines', methods=['GET'])
def list_pipelines():
    """List all quality pipelines"""
    try:
        dags_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dags')

        if not os.path.exists(dags_dir):
            return jsonify({'pipelines': []}), 200

        pipelines = []
        for filename in os.listdir(dags_dir):
            if filename.endswith('_quality_pipeline.yaml'):
                dag_path = os.path.join(dags_dir, filename)
                try:
                    with open(dag_path, 'r') as f:
                        workflow = yaml.safe_load(f)
                        pipelines.append({
                            'filename': filename,
                            'name': workflow.get('name', ''),
                            'description': workflow.get('description', ''),
                            'steps_count': len(workflow.get('steps', [])),
                            'dagu_url': f'http://localhost:8080/dags/{filename.replace(".yaml", "")}'
                        })
                except Exception:
                    pass

        return jsonify({'pipelines': pipelines}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@quality_bp.route('/pipeline/<filename>', methods=['DELETE'])
def delete_pipeline(filename):
    """Delete a quality pipeline"""
    try:
        # Security: Only allow deleting quality pipeline files
        if not filename.endswith('_quality_pipeline.yaml'):
            return jsonify({'error': 'Invalid pipeline filename'}), 400

        dags_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dags')
        dag_path = os.path.join(dags_dir, filename)

        if not os.path.exists(dag_path):
            return jsonify({'error': 'Pipeline not found'}), 404

        # Read pipeline name before deletion
        pipeline_name = 'Unknown'
        try:
            with open(dag_path, 'r') as f:
                workflow = yaml.safe_load(f)
                pipeline_name = workflow.get('name', 'Unknown')
        except Exception:
            pass

        # Delete the file
        os.remove(dag_path)

        return jsonify({
            'message': 'Pipeline deleted successfully',
            'pipeline_name': pipeline_name,
            'filename': filename
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
