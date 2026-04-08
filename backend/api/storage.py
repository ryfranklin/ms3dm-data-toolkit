"""
Storage Management API endpoints
Monitor storage usage and trigger cleanup jobs
"""
from flask import Blueprint, jsonify, request, current_app
import os
from datetime import datetime, timedelta

storage_bp = Blueprint('storage', __name__)


def _store():
    return current_app.config['METADATA_STORE']


# Directories to monitor (only file-based dirs that remain)
MONITORED_DIRS = {
    'logs': os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs'),
    'dagu_logs': os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dagu', 'logs'),
}

# Storage thresholds (in MB)
STORAGE_THRESHOLDS = {
    'warning': 100,   # Warn at 100MB
    'critical': 500,  # Critical at 500MB
}


def get_directory_size(path):
    """Calculate directory size in bytes"""
    total = 0
    try:
        if os.path.exists(path):
            for dirpath, dirnames, filenames in os.walk(path):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    try:
                        total += os.path.getsize(filepath)
                    except (OSError, FileNotFoundError):
                        pass
    except Exception as e:
        print(f"Error calculating size for {path}: {e}")
    return total


def bytes_to_mb(bytes_size):
    """Convert bytes to megabytes"""
    return round(bytes_size / (1024 * 1024), 2)


def get_file_count(path):
    """Count files in directory"""
    count = 0
    try:
        if os.path.exists(path):
            for dirpath, dirnames, filenames in os.walk(path):
                count += len(filenames)
    except Exception:
        pass
    return count


def get_oldest_file_age(path):
    """Get age of oldest file in days"""
    oldest_time = None
    try:
        if os.path.exists(path):
            for dirpath, dirnames, filenames in os.walk(path):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    try:
                        mtime = os.path.getmtime(filepath)
                        if oldest_time is None or mtime < oldest_time:
                            oldest_time = mtime
                    except (OSError, FileNotFoundError):
                        pass

            if oldest_time:
                age_days = (datetime.now().timestamp() - oldest_time) / 86400
                return int(age_days)
    except Exception:
        pass
    return None


@storage_bp.route('/status', methods=['GET'])
def get_storage_status():
    """Get current storage usage for all monitored directories"""
    try:
        directory_stats = {}
        total_size_bytes = 0
        total_files = 0

        for name, path in MONITORED_DIRS.items():
            size_bytes = get_directory_size(path)
            size_mb = bytes_to_mb(size_bytes)
            file_count = get_file_count(path)
            oldest_age = get_oldest_file_age(path)

            directory_stats[name] = {
                'path': path,
                'size_bytes': size_bytes,
                'size_mb': size_mb,
                'file_count': file_count,
                'oldest_file_days': oldest_age,
                'exists': os.path.exists(path)
            }

            total_size_bytes += size_bytes
            total_files += file_count

        total_size_mb = bytes_to_mb(total_size_bytes)

        # Determine status level
        status_level = 'healthy'
        if total_size_mb >= STORAGE_THRESHOLDS['critical']:
            status_level = 'critical'
        elif total_size_mb >= STORAGE_THRESHOLDS['warning']:
            status_level = 'warning'

        # Calculate space that could be recovered
        recoverable_mb = 0
        for name, stats in directory_stats.items():
            if stats['oldest_file_days'] and stats['oldest_file_days'] > 30:
                # Estimate: assume 50% of files are older than 30 days
                recoverable_mb += stats['size_mb'] * 0.5

        return jsonify({
            'status': status_level,
            'total_size_mb': total_size_mb,
            'total_files': total_files,
            'directories': directory_stats,
            'thresholds': STORAGE_THRESHOLDS,
            'estimated_recoverable_mb': round(recoverable_mb, 2),
            'cleanup_recommended': total_size_mb >= STORAGE_THRESHOLDS['warning'],
            'timestamp': datetime.now().isoformat()
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def is_cleanup_overdue():
    """Check if cleanup hasn't run in recommended interval (7 days)"""
    last_run = _store().get_last_cleanup()
    if last_run is None:
        return True  # Never run

    days_since = (datetime.now() - last_run).days
    return days_since >= 7


@storage_bp.route('/cleanup-info', methods=['GET'])
def get_cleanup_info():
    """Get information about cleanup job"""
    try:
        last_run = _store().get_last_cleanup()
        overdue = is_cleanup_overdue()

        days_since = None
        if last_run:
            days_since = (datetime.now() - last_run).days

        return jsonify({
            'dag_name': 'storage_cleanup',
            'dagu_url': 'http://localhost:8080/dags/storage_cleanup',
            'schedule': 'Weekly on Sunday at 2 AM',
            'retention_days': 30,
            'description': 'Automatically cleans up old files to reduce storage usage',
            'actions': [
                'Remove application log files older than 30 days',
                'Remove Dagu workflow logs older than 30 days',
                'Quality results, expectations, catalog metadata, and flows are stored in SQL Server'
            ],
            'last_run': last_run.isoformat() if last_run else None,
            'days_since_last_run': days_since,
            'overdue': overdue,
            'recommended_interval_days': 7
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@storage_bp.route('/execute-cleanup', methods=['POST'])
def execute_cleanup():
    """Execute the actual cleanup operations"""
    try:
        retention_days = int(request.json.get('retention_days', 30)) if request.json else 30

        results = {
            'before': {},
            'after': {},
            'actions': []
        }

        # Get storage usage before cleanup
        for name, path in MONITORED_DIRS.items():
            size_mb = bytes_to_mb(get_directory_size(path))
            file_count = get_file_count(path)
            results['before'][name] = {
                'size_mb': size_mb,
                'file_count': file_count
            }

        # Cleanup old application logs
        if os.path.exists(MONITORED_DIRS['logs']):
            deleted_count = 0
            cutoff_time = datetime.now().timestamp() - (retention_days * 86400)

            for root, dirs, files in os.walk(MONITORED_DIRS['logs']):
                for filename in files:
                    if filename.endswith('.log'):
                        filepath = os.path.join(root, filename)
                        try:
                            if os.path.getmtime(filepath) < cutoff_time:
                                os.remove(filepath)
                                deleted_count += 1
                        except Exception:
                            pass

            results['actions'].append(f'Removed {deleted_count} old application log files')

        # Cleanup old Dagu workflow logs
        if os.path.exists(MONITORED_DIRS['dagu_logs']):
            deleted_count = 0
            cutoff_time = datetime.now().timestamp() - (retention_days * 86400)

            for root, dirs, files in os.walk(MONITORED_DIRS['dagu_logs']):
                for filename in files:
                    # Clean up Dagu log files (.log, .dat files)
                    if filename.endswith(('.log', '.dat', '.tmp')):
                        filepath = os.path.join(root, filename)
                        try:
                            if os.path.getmtime(filepath) < cutoff_time:
                                os.remove(filepath)
                                deleted_count += 1
                        except Exception:
                            pass

            results['actions'].append(f'Removed {deleted_count} old Dagu workflow log files')

        results['actions'].append('Quality results, expectations, catalog metadata stored in SQL Server (no file cleanup needed)')

        # Get storage usage after cleanup
        for name, path in MONITORED_DIRS.items():
            size_mb = bytes_to_mb(get_directory_size(path))
            file_count = get_file_count(path)
            results['after'][name] = {
                'size_mb': size_mb,
                'file_count': file_count
            }

        # Calculate space recovered
        total_before = sum(d['size_mb'] for d in results['before'].values())
        total_after = sum(d['size_mb'] for d in results['after'].values())
        space_recovered = total_before - total_after

        results['summary'] = {
            'storage_before_mb': round(total_before, 2),
            'storage_after_mb': round(total_after, 2),
            'space_recovered_mb': round(space_recovered, 2),
            'retention_days': retention_days
        }

        # Record the cleanup
        _store().set_last_cleanup()

        return jsonify({
            'success': True,
            'message': 'Cleanup completed successfully',
            'results': results
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@storage_bp.route('/trigger-cleanup', methods=['POST'])
def trigger_cleanup():
    """Trigger the cleanup job via Dagu API"""
    try:
        import requests

        # Trigger Dagu workflow
        dagu_url = 'http://dagu:8080/api/v2/dags/storage_cleanup/start'

        try:
            response = requests.post(dagu_url, timeout=5)

            if response.status_code == 200:
                # Record the trigger
                _store().set_last_cleanup()

                return jsonify({
                    'success': True,
                    'message': 'Cleanup job triggered successfully',
                    'dagu_url': 'http://localhost:8080/dags/storage_cleanup',
                    'note': 'Check Dagu UI to monitor execution'
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'message': f'Failed to trigger cleanup job: {response.status_code}',
                    'dagu_url': 'http://localhost:8080/dags/storage_cleanup',
                    'note': 'You can trigger manually in Dagu UI'
                }), 500

        except requests.exceptions.RequestException as e:
            return jsonify({
                'success': False,
                'message': 'Could not connect to Dagu. Please trigger manually.',
                'dagu_url': 'http://localhost:8080/dags/storage_cleanup',
                'error': str(e)
            }), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@storage_bp.route('/recommendations', methods=['GET'])
def get_recommendations():
    """Get storage cleanup recommendations"""
    try:
        recommendations = []

        for name, path in MONITORED_DIRS.items():
            size_mb = bytes_to_mb(get_directory_size(path))
            file_count = get_file_count(path)
            oldest_age = get_oldest_file_age(path)

            if size_mb > 50:
                recommendations.append({
                    'severity': 'warning' if size_mb > 100 else 'info',
                    'directory': name,
                    'message': f'{name} is using {size_mb} MB',
                    'action': f'Consider running cleanup job to remove old files'
                })

            if oldest_age and oldest_age > 90:
                recommendations.append({
                    'severity': 'info',
                    'directory': name,
                    'message': f'{name} has files older than {oldest_age} days',
                    'action': 'Run cleanup to remove outdated files'
                })

            if file_count > 1000:
                recommendations.append({
                    'severity': 'warning',
                    'directory': name,
                    'message': f'{name} contains {file_count} files',
                    'action': 'High file count may slow down operations'
                })

        return jsonify({
            'recommendations': recommendations,
            'total_recommendations': len(recommendations)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
