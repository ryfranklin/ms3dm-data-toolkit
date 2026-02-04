import React, { useState, useEffect } from 'react';
import axios from 'axios';

function StorageWarning() {
  const [storageStatus, setStorageStatus] = useState(null);
  const [cleanupInfo, setCleanupInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    fetchStorageStatus();
    // Check storage every 5 minutes
    const interval = setInterval(fetchStorageStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchStorageStatus = async () => {
    try {
      const [statusRes, infoRes] = await Promise.all([
        axios.get('http://localhost:8000/api/storage/status'),
        axios.get('http://localhost:8000/api/storage/cleanup-info')
      ]);
      
      setStorageStatus(statusRes.data);
      setCleanupInfo(infoRes.data);
    } catch (err) {
      console.error('Error fetching storage status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCleanupJob = () => {
    if (cleanupInfo?.dagu_url) {
      window.open(cleanupInfo.dagu_url, '_blank', 'width=1400,height=900');
    }
  };

  const handleTriggerCleanup = async () => {
    setTriggering(true);
    try {
      const response = await axios.post('http://localhost:8000/api/storage/trigger-cleanup');
      
      if (response.data.success) {
        alert('✅ Cleanup job started successfully!\n\nCheck Dagu UI to monitor execution.');
        // Open Dagu in new window
        window.open(response.data.dagu_url, '_blank', 'width=1400,height=900');
        // Refresh status after a delay
        setTimeout(() => {
          fetchStorageStatus();
        }, 3000);
      } else {
        alert('⚠️ Could not trigger cleanup automatically.\n\n' + response.data.message + '\n\nOpening Dagu UI where you can start it manually.');
        window.open(response.data.dagu_url, '_blank', 'width=1400,height=900');
      }
    } catch (err) {
      console.error('Error triggering cleanup:', err);
      alert('⚠️ Could not trigger cleanup.\n\nOpening Dagu UI where you can start it manually.');
      handleOpenCleanupJob();
    } finally {
      setTriggering(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Store dismissal in localStorage for this session
    sessionStorage.setItem('storage-warning-dismissed', 'true');
  };

  // Check if already dismissed in this session
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem('storage-warning-dismissed');
    if (wasDismissed) {
      setDismissed(true);
    }
  }, []);

  if (loading || !storageStatus || !cleanupInfo) {
    return null;
  }

  // Check if cleanup is overdue (priority over storage warnings)
  const showOverduePrompt = cleanupInfo.overdue && !dismissed;
  
  // Show storage warning if unhealthy
  const showStorageWarning = storageStatus.status !== 'healthy' && !dismissed;
  
  // Don't show anything if dismissed or healthy and not overdue
  if (!showOverduePrompt && !showStorageWarning) {
    return null;
  }

  const statusConfig = {
    overdue: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-300',
      textColor: 'text-blue-900',
      iconColor: 'text-blue-600',
      icon: '🧹',
      title: 'Cleanup Recommended'
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-300',
      textColor: 'text-yellow-900',
      iconColor: 'text-yellow-600',
      icon: '⚠️',
      title: 'Storage Warning'
    },
    critical: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-300',
      textColor: 'text-red-900',
      iconColor: 'text-red-600',
      icon: '🚨',
      title: 'Critical Storage Alert'
    }
  };

  // Determine which alert to show (overdue takes priority if storage is healthy)
  const alertType = showOverduePrompt && storageStatus.status === 'healthy' 
    ? 'overdue' 
    : storageStatus.status;
  const config = statusConfig[alertType];

  return (
    <div className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4 mb-4 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <span className="text-2xl">{config.icon}</span>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold ${config.textColor}`}>
                {config.title}
              </h3>
              <button
                onClick={() => setExpanded(!expanded)}
                className={`text-sm ${config.textColor} hover:underline`}
              >
                {expanded ? '▼ Less' : '▶ More'}
              </button>
            </div>
            
            <div className="mt-2">
              {alertType === 'overdue' ? (
                <>
                  <p className={`text-sm ${config.textColor}`}>
                    {cleanupInfo.last_run ? (
                      <>
                        Last cleanup: <strong>{cleanupInfo.days_since_last_run} days ago</strong>
                        {' '}(recommended: every 7 days)
                      </>
                    ) : (
                      <>
                        Cleanup job has <strong>never been run</strong>
                        {' '}(recommended: every 7 days)
                      </>
                    )}
                  </p>
                  <p className={`text-sm ${config.textColor} mt-1`}>
                    Current storage: <strong>{storageStatus.total_size_mb} MB</strong> across{' '}
                    <strong>{storageStatus.total_files}</strong> files
                  </p>
                  {storageStatus.estimated_recoverable_mb > 0 && (
                    <p className={`text-sm ${config.textColor} mt-1`}>
                      Estimated recoverable: <strong>{storageStatus.estimated_recoverable_mb} MB</strong>
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className={`text-sm ${config.textColor}`}>
                    Storage usage: <strong>{storageStatus.total_size_mb} MB</strong> across{' '}
                    <strong>{storageStatus.total_files}</strong> files
                  </p>
                  
                  {storageStatus.estimated_recoverable_mb > 0 && (
                    <p className={`text-sm ${config.textColor} mt-1`}>
                      Estimated recoverable space: <strong>{storageStatus.estimated_recoverable_mb} MB</strong>
                    </p>
                  )}
                  
                  {cleanupInfo.last_run && (
                    <p className={`text-xs ${config.textColor} mt-1 opacity-75`}>
                      Last cleanup: {cleanupInfo.days_since_last_run} days ago
                    </p>
                  )}
                </>
              )}
            </div>

            {expanded && (
              <div className="mt-3 space-y-2">
                {/* Directory breakdown */}
                <div className="text-xs">
                  <p className={`font-semibold ${config.textColor} mb-2`}>Storage Breakdown:</p>
                  <div className="space-y-1">
                    {Object.entries(storageStatus.directories).map(([name, stats]) => (
                      <div key={name} className="flex justify-between items-center">
                        <span className="font-mono">{name}:</span>
                        <span className="font-medium">
                          {stats.size_mb} MB ({stats.file_count} files)
                          {stats.oldest_file_days && (
                            <span className="ml-2 text-gray-600">
                              (oldest: {stats.oldest_file_days}d)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cleanup info */}
                {cleanupInfo && (
                  <div className="mt-3 pt-3 border-t border-yellow-300">
                    <p className={`text-xs font-semibold ${config.textColor} mb-2`}>
                      Automatic Cleanup Job:
                    </p>
                    <p className="text-xs text-gray-700">
                      Schedule: {cleanupInfo.schedule}
                    </p>
                    <p className="text-xs text-gray-700">
                      Retention: {cleanupInfo.retention_days} days
                    </p>
                    <ul className="mt-2 space-y-1">
                      {cleanupInfo.actions?.map((action, idx) => (
                        <li key={idx} className="text-xs text-gray-700 flex items-start">
                          <span className="mr-2">•</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center space-x-3 flex-wrap gap-2">
              <button
                onClick={handleTriggerCleanup}
                disabled={triggering}
                className={`px-4 py-2 text-sm font-medium text-white rounded shadow-sm transition-colors ${
                  triggering 
                    ? 'bg-gray-400 cursor-not-allowed'
                    : alertType === 'critical'
                    ? 'bg-red-600 hover:bg-red-700'
                    : alertType === 'overdue'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-yellow-600 hover:bg-yellow-700'
                }`}
              >
                {triggering ? '⏳ Starting...' : '▶️ Run Cleanup Now'}
              </button>
              
              <button
                onClick={handleOpenCleanupJob}
                className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                🗂️ View in Dagu
              </button>
              
              <button
                onClick={fetchStorageStatus}
                className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                🔄 Refresh
              </button>
              
              <button
                onClick={handleDismiss}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Dismiss for this session
              </button>
            </div>
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className={`ml-3 ${config.textColor} hover:opacity-70`}
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default StorageWarning;
