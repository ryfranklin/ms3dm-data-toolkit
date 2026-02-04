import React, { useState, useEffect } from 'react';
import { schedulerApi } from '../../api/client';

function ExecutionHistory() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [logs, setLogs] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    fetchExecutions();
  }, []);

  const fetchExecutions = async () => {
    try {
      setLoading(true);
      const response = await schedulerApi.getExecutions();
      setExecutions(response || []);
    } catch (err) {
      console.error('Error fetching executions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (dagId, executionId) => {
    try {
      setLoadingLogs(true);
      const response = await schedulerApi.getLogs(dagId, executionId);
      setLogs(response);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setLogs({ error: 'Failed to load logs' });
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleViewLogs = (execution) => {
    setSelectedExecution(execution);
    fetchLogs(execution.dagId, execution.id);
  };

  const getStatusIcon = (status) => {
    const icons = {
      'success': '✓',
      'failed': '✗',
      'running': '▶',
      'pending': '⏳',
    };
    return icons[status?.toLowerCase()] || '○';
  };

  const getStatusColor = (status) => {
    const colors = {
      'success': 'text-green-600 bg-green-50',
      'failed': 'text-red-600 bg-red-50',
      'running': 'text-blue-600 bg-blue-50',
      'pending': 'text-yellow-600 bg-yellow-50',
    };
    return colors[status?.toLowerCase()] || 'text-gray-600 bg-gray-50';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-gray-600">Loading execution history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Execution List */}
      <div className="w-1/2 border-r border-gray-200 overflow-y-auto bg-white">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Recent Executions</h2>
          <p className="text-xs text-gray-600 mt-1">
            {executions.length} execution(s) found
          </p>
        </div>

        {executions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-sm text-gray-600">No executions yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Run a pipeline to see execution history
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {executions.map((execution) => (
              <div
                key={execution.id}
                onClick={() => handleViewLogs(execution)}
                className={`
                  p-4 cursor-pointer hover:bg-gray-50 transition-colors
                  ${selectedExecution?.id === execution.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 text-sm mb-1">
                      {execution.dagName || execution.dagId}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {new Date(execution.startTime).toLocaleString()}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                    {getStatusIcon(execution.status)} {execution.status}
                  </div>
                </div>

                <div className="flex items-center text-xs text-gray-600 space-x-4">
                  <span>⏱ {formatDuration(execution.duration)}</span>
                  {execution.steps && (
                    <span>📋 {execution.steps} steps</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logs Panel */}
      <div className="w-1/2 bg-gray-900 text-gray-100 overflow-hidden flex flex-col">
        {!selectedExecution ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <div className="text-4xl mb-3">📄</div>
              <p>Select an execution to view logs</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-700 bg-gray-800">
              <h3 className="font-semibold text-white mb-1">
                Execution Logs
              </h3>
              <p className="text-xs text-gray-400">
                {selectedExecution.dagName} • {new Date(selectedExecution.startTime).toLocaleString()}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingLogs ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="text-2xl mb-2">⏳</div>
                  <p className="text-sm">Loading logs...</p>
                </div>
              ) : logs?.error ? (
                <div className="text-red-400 text-sm">
                  {logs.error}
                </div>
              ) : logs ? (
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {logs.content || 'No logs available'}
                </pre>
              ) : (
                <div className="text-gray-500 text-sm">
                  No logs available
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ExecutionHistory;
