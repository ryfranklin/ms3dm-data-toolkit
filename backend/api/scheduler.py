"""
Scheduler API endpoints for Dagu integration
"""
from flask import Blueprint, request, jsonify
import os
import yaml
import re

scheduler_bp = Blueprint('scheduler', __name__)

# Path to dags directory (mounted volume in Docker)
DAGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dags')


@scheduler_bp.route('/create-dag', methods=['POST'])
def create_dag():
    """Create a new DAG YAML file"""
    try:
        data = request.json
        yaml_content = data.get('yaml')
        
        
        if not yaml_content:
            return jsonify({'error': 'yaml content is required'}), 400
        
        # Parse YAML to extract the name
        try:
            dag_config = yaml.safe_load(yaml_content)
            dag_name = dag_config.get('name')
            
            if not dag_name:
                return jsonify({'error': 'DAG name is required in YAML'}), 400
            
            # Validate name format (alphanumeric, dashes, dots, underscores only)
            if not re.match(r'^[a-zA-Z0-9_.-]+$', dag_name):
                return jsonify({
                    'error': 'DAG name must only contain alphanumeric characters, dashes, dots, and underscores'
                }), 400
                
        except yaml.YAMLError as e:
            return jsonify({'error': f'Invalid YAML format: {str(e)}'}), 400
        
        # Ensure dags directory exists
        os.makedirs(DAGS_DIR, exist_ok=True)
        
        # Write the YAML file
        file_path = os.path.join(DAGS_DIR, f'{dag_name}.yaml')
        
        # Check if file already exists
        if os.path.exists(file_path):
            return jsonify({
                'error': f'Pipeline "{dag_name}" already exists. Please use a different name.'
            }), 409
        
        with open(file_path, 'w') as f:
            f.write(yaml_content)
        
        return jsonify({
            'success': True,
            'message': f'Pipeline "{dag_name}" created successfully',
            'file_path': file_path,
            'dag_name': dag_name
        }), 201
        
    except Exception as e:
        return jsonify({'error': f'Failed to create pipeline: {str(e)}'}), 500


@scheduler_bp.route('/dags/<dag_id>', methods=['DELETE'])
def delete_dag(dag_id):
    """Delete a DAG YAML file"""
    try:
        # Validate name format
        if not re.match(r'^[a-zA-Z0-9_.-]+$', dag_id):
            return jsonify({'error': 'Invalid DAG name'}), 400
        
        file_path = os.path.join(DAGS_DIR, f'{dag_id}.yaml')
        
        if not os.path.exists(file_path):
            return jsonify({'error': f'Pipeline "{dag_id}" not found'}), 404
        
        os.remove(file_path)
        
        return jsonify({
            'success': True,
            'message': f'Pipeline "{dag_id}" deleted successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to delete pipeline: {str(e)}'}), 500


@scheduler_bp.route('/dags', methods=['GET'])
def list_dags():
    """List all DAG files"""
    try:
        if not os.path.exists(DAGS_DIR):
            return jsonify({'dags': []}), 200
        
        dags = []
        for filename in os.listdir(DAGS_DIR):
            if filename.endswith('.yaml') or filename.endswith('.yml'):
                file_path = os.path.join(DAGS_DIR, filename)
                try:
                    with open(file_path, 'r') as f:
                        dag_config = yaml.safe_load(f)
                        dags.append({
                            'id': dag_config.get('name', filename[:-5]),
                            'name': dag_config.get('name', filename[:-5]),
                            'description': dag_config.get('description', ''),
                            'schedule': dag_config.get('schedule', ''),
                            'tags': dag_config.get('tags', []),
                            'steps': len(dag_config.get('steps', [])),
                        })
                except Exception as e:
                    print(f"Error reading {filename}: {e}")
                    continue
        
        return jsonify({'dags': dags}), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to list pipelines: {str(e)}'}), 500


@scheduler_bp.route('/dags/<dag_id>', methods=['GET'])
def get_dag(dag_id):
    """Get a specific DAG configuration"""
    try:
        # Validate name format
        if not re.match(r'^[a-zA-Z0-9_.-]+$', dag_id):
            return jsonify({'error': 'Invalid DAG name'}), 400
        
        file_path = os.path.join(DAGS_DIR, f'{dag_id}.yaml')
        
        if not os.path.exists(file_path):
            return jsonify({'error': f'Pipeline "{dag_id}" not found'}), 404
        
        with open(file_path, 'r') as f:
            dag_config = yaml.safe_load(f)
            yaml_content = f.read()
        
        return jsonify({
            'id': dag_id,
            'config': dag_config,
            'yaml': yaml_content
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get pipeline: {str(e)}'}), 500


@scheduler_bp.route('/dags/<dag_id>/trigger', methods=['POST'])
def trigger_dag(dag_id):
    """Trigger a DAG via docker exec (since Dagu API /start has issues)"""
    try:
        import subprocess
        
        # Validate name format
        if not re.match(r'^[a-zA-Z0-9_.-]+$', dag_id):
            return jsonify({'error': 'Invalid DAG name'}), 400
        
        # Check if DAG file exists
        file_path = os.path.join(DAGS_DIR, f'{dag_id}.yaml')
        if not os.path.exists(file_path):
            return jsonify({'error': f'Pipeline "{dag_id}" not found'}), 404
        
        # Trigger via docker exec dagu CLI
        result = subprocess.run(
            ['docker', 'exec', 'ms3dm_dagu', 'dagu', 'start', dag_id],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            return jsonify({
                'success': True,
                'message': f'Pipeline "{dag_id}" triggered successfully',
                'output': result.stdout
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': f'Failed to trigger pipeline: {result.stderr}',
                'output': result.stdout
            }), 500
        
    except subprocess.TimeoutExpired:
        return jsonify({
            'error': 'Pipeline trigger timed out'
        }), 504
    except Exception as e:
        return jsonify({'error': f'Failed to trigger pipeline: {str(e)}'}), 500
