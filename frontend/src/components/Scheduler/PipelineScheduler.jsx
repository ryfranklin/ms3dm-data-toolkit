import React, { useState, useEffect } from 'react';
import { schedulerApi } from '../../api/client';
import DagList from './DagList';
import ExecutionHistory from './ExecutionHistory';
import PipelineBuilder from './PipelineBuilder';

function PipelineScheduler() {
  const [activeTab, setActiveTab] = useState('pipelines');
  const [dags, setDags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchDags();
  }, [refreshKey]);

  const fetchDags = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await schedulerApi.listDags();
      setDags(response || []);
    } catch (err) {
      setError('Failed to fetch pipelines: ' + err.message);
      console.error('Error fetching DAGs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const tabs = [
    { id: 'pipelines', label: 'Pipelines', icon: '📋', dataTab: 'pipelines' },
    { id: 'history', label: 'Execution History', icon: '📊', dataTab: 'history' },
    { id: 'builder', label: 'Create Pipeline', icon: '➕', dataTab: 'builder' },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Pipeline Scheduler
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Schedule and monitor data quality pipelines
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:bg-gray-50 text-sm font-medium"
              title="Refresh pipelines"
            >
              🔄 Refresh
            </button>
            <a
              href="http://localhost:8080"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium shadow-sm"
            >
              🚀 Open Dagu UI
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mt-4 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-tab={tab.dataTab}
              className={`
                px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }
              `}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'pipelines' && (
          <DagList 
            dags={dags} 
            loading={loading} 
            onRefresh={handleRefresh}
          />
        )}
        {activeTab === 'history' && (
          <ExecutionHistory />
        )}
        {activeTab === 'builder' && (
          <PipelineBuilder onPipelineCreated={handleRefresh} />
        )}
      </div>
    </div>
  );
}

export default PipelineScheduler;
