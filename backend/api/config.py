"""
Configuration API endpoints
Manage SQL Server connections
"""
from flask import Blueprint, request, jsonify
from utils.config_manager import ConfigManager
from services.db_connector import DBConnector

config_bp = Blueprint('config', __name__)
config_manager = ConfigManager()

@config_bp.route('/', methods=['GET'])
def get_connections():
    """Get all configured connections"""
    try:
        connections = config_manager.get_all_connections()
        return jsonify({'connections': connections}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@config_bp.route('/<connection_id>', methods=['GET'])
def get_connection(connection_id):
    """Get a specific connection by ID"""
    try:
        connection = config_manager.get_connection(connection_id)
        if connection:
            return jsonify(connection), 200
        return jsonify({'error': 'Connection not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@config_bp.route('/', methods=['POST'])
def create_connection():
    """Create a new connection"""
    try:
        data = request.json
        connection_id = config_manager.add_connection(data)
        return jsonify({
            'message': 'Connection created successfully',
            'connection_id': connection_id
        }), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@config_bp.route('/<connection_id>', methods=['PUT'])
def update_connection(connection_id):
    """Update an existing connection"""
    try:
        data = request.json
        config_manager.update_connection(connection_id, data)
        return jsonify({'message': 'Connection updated successfully'}), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@config_bp.route('/<connection_id>', methods=['DELETE'])
def delete_connection(connection_id):
    """Delete a connection"""
    try:
        config_manager.delete_connection(connection_id)
        return jsonify({'message': 'Connection deleted successfully'}), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@config_bp.route('/<connection_id>/test', methods=['POST'])
def test_connection(connection_id):
    """Test a database connection"""
    try:
        connection = config_manager.get_connection(connection_id)
        if not connection:
            return jsonify({'error': 'Connection not found'}), 404
        
        db_connector = DBConnector(connection)
        success, message = db_connector.test_connection()
        
        if success:
            return jsonify({
                'success': True,
                'message': message
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': message
            }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
