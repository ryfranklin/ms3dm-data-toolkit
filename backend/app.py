"""
MS3DM Workbench - Flask Backend
Main application entry point.

In the bundled desktop build this single Flask process serves both the
JSON API (under /api/*) and the built React app (everything else).
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from api.catalog import catalog_bp
from api.config import config_bp
from api.dbt import dbt_bp
from api.docs import docs_bp
from api.expectations import expectations_bp
from api.local_etl import local_etl_bp
from api.quality import quality_bp
from api.scheduler import scheduler_bp
from api.setup import setup_bp
from api.storage import storage_bp
from services.app_config import load_metadata_config
from services.metadata_store import MetadataStore

# Load .env early so env-based MetadataStore config works before create_app.
load_dotenv()


def _resource_root() -> Path:
    """
    Return the directory that contains bundled resources (frontend static
    files and the like). When frozen by PyInstaller, sys._MEIPASS points at
    the temp extraction dir; otherwise it's the backend/ directory.
    """
    if getattr(sys, 'frozen', False):
        return Path(getattr(sys, '_MEIPASS', os.path.dirname(sys.executable)))
    return Path(__file__).parent


def _try_init_metadata_store():
    """Attempt to load config + initialize the store. Returns store or None."""
    cfg = load_metadata_config()
    if not cfg:
        return None
    try:
        store = MetadataStore(cfg)
        store.initialize()
        return store
    except Exception as exc:
        # Don't crash on bad creds — let the user re-run setup via the UI.
        print(f"[ms3dm] metadata store init failed: {exc}", file=sys.stderr)
        return None


def create_app():
    """Create and configure the Flask application."""
    static_root = _resource_root() / 'static'
    app = Flask(
        __name__,
        static_folder=str(static_root) if static_root.is_dir() else None,
        static_url_path='',
    )

    # CORS only needed for `npm run dev` (separate origin). Same-origin in prod.
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'False') == '1'
    app.config['ENV'] = os.getenv('FLASK_ENV', 'production')
    app.config['METADATA_STORE'] = _try_init_metadata_store()

    # ----- API blueprints -----
    app.register_blueprint(setup_bp, url_prefix='/api/setup')
    app.register_blueprint(config_bp, url_prefix='/api/config')
    app.register_blueprint(quality_bp, url_prefix='/api/quality')
    app.register_blueprint(docs_bp, url_prefix='/api/docs')
    app.register_blueprint(expectations_bp, url_prefix='/api/expectations')
    app.register_blueprint(scheduler_bp, url_prefix='/api/scheduler')
    app.register_blueprint(catalog_bp, url_prefix='/api/catalog')
    app.register_blueprint(storage_bp, url_prefix='/api/storage')
    app.register_blueprint(dbt_bp, url_prefix='/api/dbt')
    app.register_blueprint(local_etl_bp, url_prefix='/api/local-etl')

    # ----- Setup-mode gate -----
    @app.before_request
    def _gate_until_configured():
        if app.config.get('METADATA_STORE') is not None:
            return None
        path = request.path
        # Always allow the setup endpoints, health check, and static assets.
        if path.startswith('/api/setup') or path == '/health':
            return None
        if path.startswith('/api/'):
            return jsonify({
                'error': 'Setup required',
                'needs_setup': True,
                'message': 'Configure a SQL Server connection at /api/setup/configure first.',
            }), 503
        return None  # static/SPA routes still serve so the setup UI loads

    # ----- Health check -----
    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'service': 'ms3dm-workbench',
            'version': '1.0.0',
            'configured': app.config.get('METADATA_STORE') is not None,
        }), 200

    # ----- Static / SPA routes -----
    # When the static folder exists (bundled build), serve the React app.
    # Otherwise return the legacy JSON root for back-compat with `make run`.
    if app.static_folder:
        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def spa(path: str):
            # Reserved paths
            if path.startswith('api/') or path == 'health':
                return jsonify({'error': 'Not found'}), 404
            full = Path(app.static_folder) / path
            if path and full.is_file():
                return send_from_directory(app.static_folder, path)
            # Fall back to index.html so React Router can take over.
            return send_from_directory(app.static_folder, 'index.html')
    else:
        @app.route('/', methods=['GET'])
        def root():
            return jsonify({
                'message': 'MS3DM Workbench API',
                'version': '1.0.0',
                'endpoints': {
                    'health': '/health',
                    'setup': '/api/setup',
                    'config': '/api/config',
                    'quality': '/api/quality',
                    'docs': '/api/docs',
                    'expectations': '/api/expectations',
                    'scheduler': '/api/scheduler',
                    'catalog': '/api/catalog',
                    'storage': '/api/storage',
                    'dbt': '/api/dbt',
                    'local_etl': '/api/local-etl',
                },
            }), 200

    # ----- Error handlers -----
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500

    return app


def main():
    """Entry point used by both `python app.py` and the PyInstaller binary."""
    app = create_app()
    port = int(os.getenv('PORT', 8000))
    debug = app.config.get('DEBUG', False)
    # In the desktop bundle, also try to open the user's browser at startup.
    if getattr(sys, 'frozen', False):
        import threading
        import webbrowser
        threading.Timer(1.5, lambda: webbrowser.open(f'http://localhost:{port}')).start()
    app.run(host='127.0.0.1' if getattr(sys, 'frozen', False) else '0.0.0.0',
            port=port, debug=debug, use_reloader=False)


if __name__ == '__main__':
    main()
