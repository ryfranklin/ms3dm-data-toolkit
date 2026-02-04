import React, { useState, useEffect } from 'react';
import { configApi } from '../../api/client';
import SchemaExplorer from './SchemaExplorer';
import TableDetails from './TableDetails';
import CatalogSearch from './CatalogSearch';
import DataDictionary from './DataDictionary';

function DataCatalog() {
  const [activeTab, setActiveTab] = useState('explorer');
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await configApi.getConnections();
      const conns = response?.connections || [];
      setConnections(conns);
      if (conns.length > 0) {
        setSelectedConnection(conns[0].id);
      }
    } catch (err) {
      console.error('Error fetching connections:', err);
    }
  };

  const handleTableSelect = (schema, table) => {
    setSelectedTable({ schema, table });
    setActiveTab('details');
  };

  const tabs = [
    { id: 'explorer', label: 'Schema Explorer', icon: '🗂️' },
    { id: 'dictionary', label: 'Data Dictionary', icon: '📚' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'details', label: 'Table Details', icon: '📊', disabled: !selectedTable },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Data Catalog
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Discover, document, and explore your database assets
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {connections.map(conn => (
                <option key={conn.id} value={conn.id}>{conn.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mt-4 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`
                px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : tab.disabled
                  ? 'border-transparent text-gray-400 cursor-not-allowed'
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

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'explorer' && (
          <SchemaExplorer 
            connectionId={selectedConnection}
            onTableSelect={handleTableSelect}
          />
        )}
        {activeTab === 'dictionary' && (
          <DataDictionary
            connectionId={selectedConnection}
          />
        )}
        {activeTab === 'search' && (
          <CatalogSearch
            connectionId={selectedConnection}
            onTableSelect={handleTableSelect}
          />
        )}
        {activeTab === 'details' && selectedTable && (
          <TableDetails
            connectionId={selectedConnection}
            schema={selectedTable.schema}
            table={selectedTable.table}
            onBack={() => setActiveTab('explorer')}
            onTableSelect={handleTableSelect}
          />
        )}
      </div>
    </div>
  );
}

export default DataCatalog;
