"""
MS3DM Toolkit - Flask Backend
Main application entry point
"""
import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import blueprints
from api.config import config_bp
from api.quality import quality_bp
from api.flows import flows_bp
from api.expectations import expectations_bp
from api.scheduler import scheduler_bp
from api.catalog import catalog_bp
from api.storage import storage_bp

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    
    # Enable CORS for frontend
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Configuration
    app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'False') == '1'
    app.config['ENV'] = os.getenv('FLASK_ENV', 'production')
    
    # Register blueprints
    app.register_blueprint(config_bp, url_prefix='/api/config')
    app.register_blueprint(quality_bp, url_prefix='/api/quality')
    app.register_blueprint(flows_bp, url_prefix='/api/flows')
    app.register_blueprint(expectations_bp, url_prefix='/api/expectations')
    app.register_blueprint(scheduler_bp, url_prefix='/api/scheduler')
    app.register_blueprint(catalog_bp, url_prefix='/api/catalog')
    app.register_blueprint(storage_bp, url_prefix='/api/storage')
    
    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'service': 'ms3dm-toolkit',
            'version': '1.0.0'
        }), 200
    
    # Root endpoint
    @app.route('/', methods=['GET'])
    def root():
        return jsonify({
            'message': 'MS3DM Toolkit API',
            'version': '1.0.0',
            'endpoints': {
                'health': '/health',
                'config': '/api/config',
                'quality': '/api/quality',
                'flows': '/api/flows',
                'expectations': '/api/expectations',
                'scheduler': '/api/scheduler',
                'catalog': '/api/catalog',
                'storage': '/api/storage'
            }
        }), 200
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500
    
    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.getenv('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=True)
