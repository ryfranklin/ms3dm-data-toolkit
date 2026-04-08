import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ConfigManager from './components/ConfigManager/ConfigManager';
import ETLWorkspace from './components/ETL/ETLWorkspace';
import Documentation from './components/Documentation/Documentation';
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
                    to="/etl"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    ETL
                  </Link>
                  <Link
                    to="/catalog"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Data Catalog
                  </Link>
                  <Link
                    to="/docs"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Documentation
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
            <Route path="/etl" element={<ETLWorkspace />} />
            <Route path="/catalog" element={<DataCatalog />} />
            <Route path="/docs" element={<Documentation />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
