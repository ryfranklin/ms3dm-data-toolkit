import React, { useState } from 'react';
import { schedulerApi } from '../../api/client';

function DagList({ dags, loading, onRefresh }) {
  const [expandedDag, setExpandedDag] = useState(null);

  const handleViewDetails = (dagId) => {
    // Open Dagu UI for this specific DAG
    const daguUrl = `http://localhost:8080/dags/${dagId}`;
    window.open(daguUrl, '_blank', 'width=1400,height=900');
  };

  const getStatusBadge = (status) => {
    const badges = {
      'success': { bg: 'bg-green-100', text: 'text-green-800', icon: '✓' },
      'failed': { bg: 'bg-red-100', text: 'text-red-800', icon: '✗' },
      'running': { bg: 'bg-blue-100', text: 'text-blue-800', icon: '▶' },
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '⏳' },
      'none': { bg: 'bg-gray-100', text: 'text-gray-800', icon: '○' },
    };
    const badge = badges[status?.toLowerCase()] || badges['none'];
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <span className="mr-1">{badge.icon}</span>
        {status || 'Not run'}
      </span>
    );
  };

  const getScheduleDisplay = (schedule) => {
    if (!schedule) return 'Manual only';
    // Parse cron expressions to human-readable
    const cronMap = {
      '0 0 * * *': 'Daily at midnight',
      '0 1 * * *': 'Daily at 1:00 AM',
      '0 */6 * * *': 'Every 6 hours',
      '0 */1 * * *': 'Every hour',
      '*/5 * * * *': 'Every 5 minutes',
    };
    return cronMap[schedule] || schedule;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-gray-600">Loading pipelines...</p>
        </div>
      </div>
    );
  }

  if (!dags || dags.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Pipelines Found</h3>
          <p className="text-sm text-gray-600 mb-4">
            Create your first pipeline in the "Create Pipeline" tab
          </p>
          <p className="text-xs text-gray-500">
            Or check that Dagu is running at <a href="http://localhost:8080" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">localhost:8080</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {dags.map((dag) => (
          <div
            key={dag.id}
            className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Card Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg mb-1">
                    {dag.name || dag.id}
                  </h3>
                  {dag.description && (
                    <p className="text-xs text-gray-600 mb-2">{dag.description}</p>
                  )}
                </div>
                {dag.status && getStatusBadge(dag.status)}
              </div>
              
              <div className="flex items-center text-xs text-gray-500 space-x-3">
                <span title="Schedule">
                  ⏰ {getScheduleDisplay(dag.schedule)}
                </span>
              </div>
            </div>

            {/* Card Body - Stats */}
            <div className="p-4 bg-gray-50">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-gray-500">Last Run</div>
                  <div className="text-sm font-medium text-gray-900">
                    {dag.lastRun ? new Date(dag.lastRun).toLocaleTimeString() : 'Never'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Next Run</div>
                  <div className="text-sm font-medium text-gray-900">
                    {dag.nextRun ? new Date(dag.nextRun).toLocaleTimeString() : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Duration</div>
                  <div className="text-sm font-medium text-gray-900">
                    {dag.duration ? `${dag.duration}s` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Card Footer - Actions */}
            <div className="p-3 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => setExpandedDag(expandedDag === dag.id ? null : dag.id)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {expandedDag === dag.id ? '▼ Less' : '▶ More Info'}
              </button>
              <button
                onClick={() => handleViewDetails(dag.id)}
                className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium shadow-sm"
                title="Open in Dagu to run, view history, and manage"
              >
                🔍 View Details
              </button>
            </div>

            {/* Expanded Details */}
            {expandedDag === dag.id && (
              <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs">
                <div className="space-y-2">
                  <div>
                    <span className="font-medium text-gray-700">ID:</span>
                    <span className="ml-2 font-mono text-gray-600">{dag.id}</span>
                  </div>
                  {dag.tags && dag.tags.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-700">Tags:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {dag.tags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {dag.steps && (
                    <div>
                      <span className="font-medium text-gray-700">Steps:</span>
                      <span className="ml-2 text-gray-600">{dag.steps} step(s)</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DagList;
