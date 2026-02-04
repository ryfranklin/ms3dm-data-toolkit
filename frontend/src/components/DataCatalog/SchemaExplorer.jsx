import React, { useState, useEffect } from 'react';
import axios from 'axios';

function SchemaExplorer({ connectionId, onTableSelect }) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSchemas, setExpandedSchemas] = useState(new Set());

  useEffect(() => {
    if (connectionId) {
      discoverCatalog();
    }
  }, [connectionId]);

  const discoverCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('http://localhost:8000/api/catalog/discover', {
        connection_id: connectionId
      });
      setCatalog(response.data);
      // Auto-expand first schema
      if (response.data?.schemas?.length > 0) {
        setExpandedSchemas(new Set([response.data.schemas[0].name]));
      }
    } catch (err) {
      console.error('Error discovering catalog:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSchema = (schemaName) => {
    setExpandedSchemas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(schemaName)) {
        newSet.delete(schemaName);
      } else {
        newSet.add(schemaName);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Discovering database schema...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-800 font-medium">Error discovering catalog</p>
          <p className="text-red-600 text-sm mt-2">{error}</p>
          <button
            onClick={discoverCatalog}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Select a connection to explore</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="p-6">
        {/* Summary */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Database Objects
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {catalog.schemas?.length || 0} schemas found
            </p>
          </div>
          <button
            onClick={discoverCatalog}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Schemas */}
        <div className="space-y-3">
          {catalog.schemas?.map(schema => {
            const isExpanded = expandedSchemas.has(schema.name);
            const totalObjects = (schema.tables?.length || 0) + (schema.views?.length || 0);

            return (
              <div
                key={schema.name}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* Schema Header */}
                <button
                  onClick={() => toggleSchema(schema.name)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">
                      {isExpanded ? '📂' : '📁'}
                    </span>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{schema.name}</p>
                      <p className="text-xs text-gray-500">
                        {schema.tables?.length || 0} tables, {schema.views?.length || 0} views
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-400">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </button>

                {/* Tables and Views */}
                {isExpanded && (
                  <div className="p-4 bg-white">
                    {/* Tables */}
                    {schema.tables && schema.tables.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          Tables ({schema.tables.length})
                        </h4>
                        <div className="space-y-1">
                          {schema.tables.map(table => (
                            <button
                              key={table.name}
                              onClick={() => onTableSelect(table.schema, table.name)}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 rounded flex items-center justify-between group transition-colors"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-blue-600">📊</span>
                                <span className="text-sm text-gray-900 font-mono">
                                  {table.name}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">
                                  {table.column_count} columns
                                </span>
                                <span className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                  →
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Views */}
                    {schema.views && schema.views.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          Views ({schema.views.length})
                        </h4>
                        <div className="space-y-1">
                          {schema.views.map(view => (
                            <button
                              key={view.name}
                              onClick={() => onTableSelect(view.schema, view.name)}
                              className="w-full px-3 py-2 text-left hover:bg-purple-50 rounded flex items-center justify-between group transition-colors"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-purple-600">👁️</span>
                                <span className="text-sm text-gray-900 font-mono">
                                  {view.name}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">
                                  {view.column_count} columns
                                </span>
                                <span className="text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                  →
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {totalObjects === 0 && (
                      <p className="text-sm text-gray-500 italic">No objects in this schema</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default SchemaExplorer;
