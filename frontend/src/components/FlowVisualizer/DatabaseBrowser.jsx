import React, { useState, useEffect } from 'react';
import { flowsApi } from '../../api/client';

function DatabaseBrowser({ connectionId, onAddTable }) {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedSchemas, setExpandedSchemas] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (connectionId) {
      loadSchema();
    }
  }, [connectionId]);

  const loadSchema = async () => {
    try {
      setLoading(true);
      const data = await flowsApi.getSchema(connectionId);
      setSchema(data);
    } catch (err) {
      console.error('Failed to load schema:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSchema = (schemaName) => {
    setExpandedSchemas(prev => ({
      ...prev,
      [schemaName]: !prev[schemaName],
    }));
  };

  const handleDragStart = (event, table) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(table));
    event.dataTransfer.effectAllowed = 'move';
  };

  if (loading) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Database Browser</h2>
        <div className="text-sm text-gray-500">Loading schema...</div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Database Browser</h2>
        <div className="text-sm text-gray-500">Select a connection to browse</div>
      </div>
    );
  }

  const filterItems = (items, term) => {
    if (!term) return items;
    return items.filter(item => 
      item.toLowerCase().includes(term.toLowerCase())
    );
  };

  return (
    <div className="p-4 border-b border-gray-200">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Database Browser</h2>
      
      <input
        type="text"
        placeholder="Search tables..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md mb-3"
      />

      <div className="space-y-2">
        {Object.entries(schema.schemas).map(([schemaName, schemaData]) => {
          const filteredTables = filterItems(schemaData.tables || [], searchTerm);
          const filteredViews = filterItems(schemaData.views || [], searchTerm);

          if (filteredTables.length === 0 && filteredViews.length === 0 && searchTerm) {
            return null;
          }

          return (
            <div key={schemaName}>
              <button
                onClick={() => toggleSchema(schemaName)}
                className="flex items-center w-full text-left px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
              >
                <span className="mr-2">{expandedSchemas[schemaName] ? '▼' : '▶'}</span>
                {schemaName}
              </button>

              {expandedSchemas[schemaName] && (
                <div className="ml-4 mt-1 space-y-1">
                  {filteredTables.map((table) => (
                    <div
                      key={table}
                      draggable
                      onDragStart={(e) => handleDragStart(e, {
                        schema: schemaName,
                        name: table,
                        full_name: `${schemaName}.${table}`,
                        type: 'table',
                      })}
                      className="px-2 py-1 text-xs text-gray-600 hover:bg-blue-50 cursor-move rounded flex items-center"
                    >
                      <span className="mr-2">📊</span>
                      {table}
                    </div>
                  ))}
                  {filteredViews.map((view) => (
                    <div
                      key={view}
                      draggable
                      onDragStart={(e) => handleDragStart(e, {
                        schema: schemaName,
                        name: view,
                        full_name: `${schemaName}.${view}`,
                        type: 'view',
                      })}
                      className="px-2 py-1 text-xs text-gray-600 hover:bg-blue-50 cursor-move rounded flex items-center"
                    >
                      <span className="mr-2">👁️</span>
                      {view}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DatabaseBrowser;
