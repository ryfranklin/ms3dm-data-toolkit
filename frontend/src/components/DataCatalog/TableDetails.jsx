import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ERDiagram from './ERDiagram';

function TableDetails({ connectionId, schema, table, onBack, onTableSelect }) {
  const [details, setDetails] = useState(null);
  const [sampleData, setSampleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('columns');
  const [editMode, setEditMode] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState({});

  useEffect(() => {
    if (connectionId && schema && table) {
      fetchTableDetails();
      fetchSampleData();
    }
  }, [connectionId, schema, table]);

  const fetchTableDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `http://localhost:8000/api/catalog/table/${schema}/${table}`,
        { params: { connection_id: connectionId, schema, table } }
      );
      setDetails(response.data);
      setEditedMetadata({
        description: response.data.description || '',
        owner: response.data.owner || '',
        tags: response.data.tags || [],
        columns: response.data.columns?.reduce((acc, col) => {
          acc[col.name] = { description: col.description || '' };
          return acc;
        }, {}) || {}
      });
    } catch (err) {
      console.error('Error fetching table details:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSampleData = async () => {
    try {
      const response = await axios.get(
        `http://localhost:8000/api/catalog/sample-data/${schema}/${table}`,
        { params: { connection_id: connectionId, schema, table, limit: 10 } }
      );
      setSampleData(response.data);
    } catch (err) {
      console.error('Error fetching sample data:', err);
    }
  };

  const saveMetadata = async () => {
    try {
      await axios.post(
        `http://localhost:8000/api/catalog/table/${schema}/${table}/metadata`,
        editedMetadata,
        { params: { connection_id: connectionId, schema, table } }
      );
      setEditMode(false);
      fetchTableDetails(); // Refresh
    } catch (err) {
      console.error('Error saving metadata:', err);
      alert('Error saving metadata: ' + (err.response?.data?.error || err.message));
    }
  };

  const updateColumnDescription = (columnName, description) => {
    setEditedMetadata(prev => ({
      ...prev,
      columns: {
        ...prev.columns,
        [columnName]: { description }
      }
    }));
  };

  const addTag = (tag) => {
    if (tag && !editedMetadata.tags.includes(tag)) {
      setEditedMetadata(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
  };

  const removeTag = (tag) => {
    setEditedMetadata(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading table details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-800 font-medium">Error loading table details</p>
          <p className="text-red-600 text-sm mt-2">{error}</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (!details) {
    return null;
  }

  const tabs = [
    { id: 'columns', label: 'Columns', icon: '📋', count: details.columns?.length },
    { id: 'sample', label: 'Sample Data', icon: '🔍' },
    { id: 'relationships', label: 'Relationships', icon: '🔗', count: details.foreign_keys?.length },
    { id: 'erd', label: 'ERD', icon: '🗺️', disabled: !details.foreign_keys || details.foreign_keys.length === 0 },
    { id: 'indexes', label: 'Indexes', icon: '⚡', count: details.indexes?.length },
  ];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <button
          onClick={onBack}
          className="text-sm text-blue-600 hover:text-blue-700 mb-3 flex items-center"
        >
          ← Back to Explorer
        </button>
        
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-bold text-gray-900 font-mono">
                {schema}.{table}
              </h2>
              {details.row_count !== null && (
                <span className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  {details.row_count.toLocaleString()} rows
                </span>
              )}
            </div>
            
            {/* Description */}
            {editMode ? (
              <textarea
                value={editedMetadata.description}
                onChange={(e) => setEditedMetadata(prev => ({ ...prev, description: e.target.value }))}
                className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Add a description for this table..."
                rows={2}
              />
            ) : (
              <p className="mt-2 text-sm text-gray-600">
                {details.description || 'No description available'}
              </p>
            )}

            {/* Tags */}
            <div className="mt-3 flex items-center space-x-2">
              {editedMetadata.tags?.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                >
                  {tag}
                  {editMode && (
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {editMode && (
                <input
                  type="text"
                  placeholder="Add tag..."
                  className="px-2 py-1 text-xs border border-gray-300 rounded"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addTag(e.target.value);
                      e.target.value = '';
                    }
                  }}
                />
              )}
            </div>

            {/* Owner */}
            <div className="mt-2 flex items-center text-sm text-gray-600">
              <span className="font-medium mr-2">Owner:</span>
              {editMode ? (
                <input
                  type="text"
                  value={editedMetadata.owner}
                  onChange={(e) => setEditedMetadata(prev => ({ ...prev, owner: e.target.value }))}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  placeholder="Enter owner..."
                />
              ) : (
                <span>{details.owner || 'Not specified'}</span>
              )}
            </div>
          </div>

          {/* Edit Button */}
          <div className="ml-4">
            {editMode ? (
              <div className="space-x-2">
                <button
                  onClick={saveMetadata}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                >
                  💾 Save
                </button>
                <button
                  onClick={() => {
                    setEditMode(false);
                    fetchTableDetails();
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
              >
                ✏️ Edit Metadata
              </button>
            )}
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
              {tab.count !== undefined && (
                <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Columns Tab */}
        {activeTab === 'columns' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Column</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Nullable</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Default</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Keys</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                </tr>
              </thead>
              <tbody>
                {details.columns?.map(column => (
                  <tr key={column.name} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-blue-600 font-medium">
                      {column.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-700">
                      {column.data_type}
                      {column.max_length && `(${column.max_length})`}
                      {column.precision && `(${column.precision},${column.scale})`}
                    </td>
                    <td className="py-3 px-4">
                      {column.nullable ? (
                        <span className="text-yellow-600">✓</span>
                      ) : (
                        <span className="text-gray-400">✗</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-xs">
                      {column.default || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {column.is_primary_key && (
                        <span className="inline-block px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded font-medium">
                          PK
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {editMode ? (
                        <input
                          type="text"
                          value={editedMetadata.columns[column.name]?.description || ''}
                          onChange={(e) => updateColumnDescription(column.name, e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          placeholder="Add description..."
                        />
                      ) : (
                        <span className="text-gray-600 text-xs">
                          {column.description || '-'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sample Data Tab */}
        {activeTab === 'sample' && (
          <div className="overflow-x-auto">
            {sampleData ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {sampleData.columns?.map(col => (
                      <th key={col} className="text-left py-3 px-4 font-semibold text-gray-700 font-mono">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleData.data?.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      {sampleData.columns?.map(col => (
                        <td key={col} className="py-2 px-4 text-gray-700 font-mono text-xs">
                          {row[col] !== null ? String(row[col]) : <span className="text-gray-400 italic">NULL</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 italic">Loading sample data...</p>
            )}
          </div>
        )}

        {/* Relationships Tab */}
        {activeTab === 'relationships' && (
          <div>
            {details.foreign_keys?.length > 0 ? (
              <div className="space-y-3">
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    💡 <strong>Tip:</strong> Switch to the <strong>ERD tab</strong> to see a visual diagram of these relationships
                  </p>
                </div>
                {details.foreign_keys.map((fk, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">🔗</span>
                      <div>
                        <p className="font-mono text-sm text-gray-900">
                          <span className="font-semibold">{fk.column}</span>
                          <span className="text-gray-500 mx-2">→</span>
                          <span className="text-blue-600">
                            {fk.referenced_schema}.{fk.referenced_table}.{fk.referenced_column}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{fk.name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No foreign key relationships</p>
            )}
          </div>
        )}

        {/* ERD Tab */}
        {activeTab === 'erd' && (
          <ERDiagram
            currentTable={{ schema: details.schema, table: details.table }}
            relationships={details.foreign_keys}
            onTableClick={(newSchema, newTable) => {
              // Navigate to the clicked table using parent's navigation handler
              if (onTableSelect) {
                onTableSelect(newSchema, newTable);
              }
            }}
          />
        )}

        {/* Indexes Tab */}
        {activeTab === 'indexes' && (
          <div>
            {details.indexes?.length > 0 ? (
              <div className="space-y-4">
                {details.indexes.map((idx, i) => {
                  // Generate CREATE INDEX SQL
                  const generateIndexSQL = () => {
                    if (idx.is_primary_key) {
                      return `-- Primary Key Constraint\nALTER TABLE [${details.schema}].[${details.table}]\n  ADD CONSTRAINT [${idx.name}]\n  PRIMARY KEY ${idx.type.replace('CLUSTERED', 'CLUSTERED').replace('NONCLUSTERED', 'NONCLUSTERED')} (${idx.key_columns})`;
                    }
                    
                    let sql = `CREATE ${idx.is_unique ? 'UNIQUE ' : ''}${idx.type.includes('NONCLUSTERED') ? 'NONCLUSTERED' : 'CLUSTERED'} INDEX [${idx.name}]\n`;
                    sql += `  ON [${details.schema}].[${details.table}] (${idx.key_columns})`;
                    
                    if (idx.included_columns) {
                      sql += `\n  INCLUDE (${idx.included_columns})`;
                    }
                    
                    if (idx.filter_definition) {
                      sql += `\n  WHERE ${idx.filter_definition}`;
                    }
                    
                    return sql;
                  };

                  const indexSQL = generateIndexSQL();

                  return (
                    <div key={i} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                      {/* Header */}
                      <div className="p-4 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <span className="text-2xl">⚡</span>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 flex-wrap">
                                <p className="font-mono text-sm text-gray-900 font-semibold">
                                  {idx.name}
                                </p>
                                {idx.is_primary_key && (
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-medium">
                                    PRIMARY KEY
                                  </span>
                                )}
                                {idx.is_unique && !idx.is_primary_key && (
                                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-medium">
                                    UNIQUE
                                  </span>
                                )}
                                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                                  {idx.type}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(indexSQL);
                              alert('✅ Index SQL copied to clipboard!');
                            }}
                            className="ml-3 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium flex items-center space-x-1"
                            title="Copy CREATE INDEX statement"
                          >
                            <span>📋</span>
                            <span>Copy SQL</span>
                          </button>
                        </div>
                      </div>

                      {/* Index Details */}
                      <div className="p-4">
                        {/* Key Columns */}
                        <div className="mb-3">
                          <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                            Key Columns
                          </h5>
                          <p className="font-mono text-sm text-gray-900 bg-blue-50 px-3 py-2 rounded border border-blue-200">
                            {idx.key_columns}
                          </p>
                        </div>

                        {/* Included Columns */}
                        {idx.included_columns && (
                          <div className="mb-3">
                            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                              Included Columns
                            </h5>
                            <p className="font-mono text-sm text-gray-700 bg-green-50 px-3 py-2 rounded border border-green-200">
                              {idx.included_columns}
                            </p>
                          </div>
                        )}

                        {/* Filter */}
                        {idx.filter_definition && (
                          <div className="mb-3">
                            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                              Filter (Filtered Index)
                            </h5>
                            <p className="font-mono text-sm text-gray-700 bg-yellow-50 px-3 py-2 rounded border border-yellow-200">
                              WHERE {idx.filter_definition}
                            </p>
                          </div>
                        )}

                        {/* SQL Statement */}
                        <div className="mt-4">
                          <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                            {idx.is_primary_key ? 'Primary Key Definition' : 'CREATE INDEX Statement'}
                          </h5>
                          <div className="bg-gray-900 rounded-md p-3 font-mono text-xs text-green-400 overflow-x-auto">
                            <pre className="whitespace-pre">{indexSQL}</pre>
                          </div>
                        </div>

                        {/* Index Properties */}
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-gray-500">Type:</span>
                              <span className="ml-2 font-medium text-gray-900">{idx.type}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Unique:</span>
                              <span className="ml-2 font-medium text-gray-900">
                                {idx.is_unique ? 'Yes' : 'No'}
                              </span>
                            </div>
                            {idx.included_columns && (
                              <div>
                                <span className="text-gray-500">Has INCLUDE:</span>
                                <span className="ml-2 font-medium text-green-700">Yes</span>
                              </div>
                            )}
                            {idx.filter_definition && (
                              <div>
                                <span className="text-gray-500">Filtered:</span>
                                <span className="ml-2 font-medium text-yellow-700">Yes</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 italic">No indexes</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TableDetails;
