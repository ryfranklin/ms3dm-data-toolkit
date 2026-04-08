"""
dbt API endpoints
Documentation, lineage, and source freshness via dbt Core
"""
from flask import Blueprint, jsonify, current_app

from services.dbt_manager import DbtManager

dbt_bp = Blueprint('dbt', __name__)


def _store():
    return current_app.config['METADATA_STORE']


def _get_manager(connection_id: str):
    """Build a DbtManager for the given connection, or return (None, error_response)."""
    store = _store()
    connection = store.get_connection(connection_id)
    if not connection:
        return None, (jsonify({'error': 'Connection not found'}), 404)
    return DbtManager(connection, store=store), None


# ------------------------------------------------------------------ #
#  Sources
# ------------------------------------------------------------------ #

@dbt_bp.route('/<connection_id>/generate-sources', methods=['POST'])
def generate_sources(connection_id):
    """Discover schema via INFORMATION_SCHEMA and write sources.yml"""
    try:
        mgr, err = _get_manager(connection_id)
        if err:
            return err
        result = mgr.generate_sources()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dbt_bp.route('/<connection_id>/sources', methods=['GET'])
def get_sources(connection_id):
    """Return generated sources.yml (parsed)"""
    try:
        mgr, err = _get_manager(connection_id)
        if err:
            return err
        sources = mgr.get_sources()
        if sources is None:
            return jsonify({'error': 'No sources.yml found. Run generate-sources first.'}), 404
        return jsonify(sources), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------ #
#  Docs generation
# ------------------------------------------------------------------ #

@dbt_bp.route('/<connection_id>/generate-docs', methods=['POST'])
def generate_docs(connection_id):
    """Full pipeline: profiles + sources + dbt docs generate"""
    try:
        mgr, err = _get_manager(connection_id)
        if err:
            return err
        result = mgr.generate_docs()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------ #
#  Artifacts
# ------------------------------------------------------------------ #

@dbt_bp.route('/<connection_id>/catalog', methods=['GET'])
def get_catalog(connection_id):
    """Serve catalog.json"""
    try:
        mgr, err = _get_manager(connection_id)
        if err:
            return err
        catalog = mgr.get_catalog()
        if catalog is None:
            return jsonify({'error': 'No catalog.json found. Run generate-docs first.'}), 404
        return jsonify(catalog), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dbt_bp.route('/<connection_id>/manifest', methods=['GET'])
def get_manifest(connection_id):
    """Serve manifest.json"""
    try:
        mgr, err = _get_manager(connection_id)
        if err:
            return err
        manifest = mgr.get_manifest()
        if manifest is None:
            return jsonify({'error': 'No manifest.json found. Run generate-docs first.'}), 404
        return jsonify(manifest), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------ #
#  Lineage
# ------------------------------------------------------------------ #

@dbt_bp.route('/<connection_id>/lineage', methods=['GET'])
def get_lineage(connection_id):
    """Extracted lineage from manifest"""
    try:
        mgr, err = _get_manager(connection_id)
        if err:
            return err
        lineage = mgr.get_lineage()
        if lineage is None:
            return jsonify({'error': 'No manifest.json found. Run generate-docs first.'}), 404
        return jsonify(lineage), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------ #
#  Status
# ------------------------------------------------------------------ #

@dbt_bp.route('/<connection_id>/status', methods=['GET'])
def get_status(connection_id):
    """Artifact existence + timestamps"""
    try:
        mgr, err = _get_manager(connection_id)
        if err:
            return err
        status = mgr.get_status()
        return jsonify(status), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------ #
#  Source freshness
# ------------------------------------------------------------------ #

@dbt_bp.route('/<connection_id>/source-freshness', methods=['POST'])
def source_freshness(connection_id):
    """Run dbt source freshness"""
    try:
        mgr, err = _get_manager(connection_id)
        if err:
            return err
        result = mgr.source_freshness()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------------------------------------------------------ #
#  Cleanup
# ------------------------------------------------------------------ #

@dbt_bp.route('/<connection_id>/artifacts', methods=['DELETE'])
def cleanup_artifacts(connection_id):
    """Remove generated artifacts for a connection"""
    try:
        mgr, err = _get_manager(connection_id)
        if err:
            return err
        result = mgr.cleanup()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
