"""
Documentation API Blueprint
CRUD endpoints for project documentation and diagrams.
"""
from flask import Blueprint, current_app, jsonify, request

docs_bp = Blueprint('docs', __name__)


def _get_store():
    return current_app.config['METADATA_STORE']


@docs_bp.route('/', methods=['GET'])
def list_documents():
    """List all documents (without full content)."""
    try:
        docs = _get_store().get_all_documents()
        return jsonify({'message': 'Documents retrieved', 'data': docs}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@docs_bp.route('/', methods=['POST'])
def create_document():
    """Create a new document."""
    try:
        data = request.get_json()
        if not data or not data.get('title'):
            return jsonify({'error': 'Title is required'}), 400

        doc_id = _get_store().create_document(data)
        doc = _get_store().get_document(doc_id)
        return jsonify({'message': 'Document created', 'data': doc}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@docs_bp.route('/<doc_id>', methods=['GET'])
def get_document(doc_id):
    """Get a single document with full content."""
    try:
        doc = _get_store().get_document(doc_id)
        if doc is None:
            return jsonify({'error': 'Document not found'}), 404
        return jsonify({'message': 'Document retrieved', 'data': doc}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@docs_bp.route('/<doc_id>', methods=['PUT'])
def update_document(doc_id):
    """Update an existing document."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        existing = _get_store().get_document(doc_id)
        if existing is None:
            return jsonify({'error': 'Document not found'}), 404

        _get_store().update_document(doc_id, data)
        doc = _get_store().get_document(doc_id)
        return jsonify({'message': 'Document updated', 'data': doc}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@docs_bp.route('/<doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    """Delete a document."""
    try:
        existing = _get_store().get_document(doc_id)
        if existing is None:
            return jsonify({'error': 'Document not found'}), 404

        _get_store().delete_document(doc_id)
        return jsonify({'message': 'Document deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@docs_bp.route('/categories', methods=['GET'])
def list_categories():
    """Get distinct document categories."""
    try:
        categories = _get_store().get_document_categories()
        return jsonify({'message': 'Categories retrieved', 'data': categories}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
