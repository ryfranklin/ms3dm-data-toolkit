import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ConfigManager from './components/ConfigManager/ConfigManager';
import QualityDashboard from './components/QualityDashboard/QualityDashboard';
import QualityBuilder from './components/QualityBuilder/QualityBuilder';
import FlowVisualizer from './components/FlowVisualizer/FlowVisualizer';
import SQLParser from './components/FlowVisualizer/SQLParser';
import PipelineScheduler from './components/Scheduler/PipelineScheduler';
import DataCatalog from './components/DataCatalog/DataCatalog';
import StorageWarning from './components/StorageWarning/StorageWarning';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-2xl font-bold text-blue-600">MS3DM Toolkit</h1>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link
                    to="/"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Configuration
                  </Link>
                  <Link
                    to="/quality"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Data Quality
                  </Link>
                  <Link
                    to="/quality-builder"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Quality Builder
                  </Link>
                  <Link
                    to="/catalog"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Data Catalog
                  </Link>
                  <Link
                    to="/scheduler"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Scheduler
                  </Link>
                  <Link
                    to="/flows"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Data Flows
                  </Link>
                  <Link
                    to="/sql-parser"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    SQL Parser
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main>
          {/* Storage Warning - appears on all pages */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            <StorageWarning />
          </div>
          
          <Routes>
            <Route path="/" element={<div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8"><ConfigManager /></div>} />
            <Route path="/quality" element={<div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8"><QualityDashboard /></div>} />
            <Route path="/quality-builder" element={<QualityBuilder />} />
            <Route path="/catalog" element={<DataCatalog />} />
            <Route path="/scheduler" element={<PipelineScheduler />} />
            <Route path="/flows" element={<FlowVisualizer />} />
            <Route path="/sql-parser" element={<SQLParser />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
