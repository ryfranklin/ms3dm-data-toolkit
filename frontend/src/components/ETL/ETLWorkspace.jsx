import React, { useState } from 'react';
import QualityDashboard from '../QualityDashboard/QualityDashboard';
import PipelineBuilder from '../QualityBuilder/PipelineBuilder';
import PipelineScheduler from '../Scheduler/PipelineScheduler';
import LocalETLPanel from '../LocalETL/LocalETLPanel';

const tabs = [
  { key: 'local-etl', label: 'Local ETL' },
  { key: 'quality', label: 'Data Quality' },
  { key: 'pipeline', label: 'Pipeline Builder' },
  { key: 'scheduler', label: 'Scheduler' },
];

export default function ETLWorkspace() {
  const [activeTab, setActiveTab] = useState('local-etl');

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-6" aria-label="ETL tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels — all stay mounted, hidden via CSS */}
      <div className={`flex-1 overflow-auto ${activeTab === 'quality' ? '' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <QualityDashboard />
        </div>
      </div>

      <div className={`flex-1 ${activeTab === 'pipeline' ? '' : 'hidden'}`}>
        <PipelineBuilder />
      </div>

      <div className={`flex-1 ${activeTab === 'scheduler' ? '' : 'hidden'}`}>
        <PipelineScheduler />
      </div>

      <div className={`flex-1 ${activeTab === 'local-etl' ? '' : 'hidden'}`}>
        <LocalETLPanel />
      </div>
    </div>
  );
}
