import React, { useState, useEffect } from 'react';
import { catalogApi } from '../../api/client';

function DataDictionary({ connectionId }) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSchema, setSelectedSchema] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('tables'); // 'tables' or 'columns'
  const [expandedTables, setExpandedTables] = useState(new Set());
  const [exportFormat, setExportFormat] = useState('html');

  useEffect(() => {
    if (connectionId) {
      loadCatalog();
    }
  }, [connectionId]);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await catalogApi.discover(connectionId);
      
      // Load metadata for each table
      const enrichedSchemas = await Promise.all(
        data.schemas.map(async (schema) => {
          const enrichedTables = await Promise.all(
            schema.tables.map(async (table) => {
              try {
                const details = await catalogApi.getTableDetails(
                  connectionId,
                  schema.name,
                  table.name
                );
                return { ...table, details };
              } catch (err) {
                console.error(`Failed to load details for ${schema.name}.${table.name}:`, err);
                return table;
              }
            })
          );
          return { ...schema, tables: enrichedTables };
        })
      );

      setCatalog({ ...data, schemas: enrichedSchemas });
    } catch (err) {
      setError(err.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  const toggleTableExpand = (tableKey) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableKey)) {
      newExpanded.delete(tableKey);
    } else {
      newExpanded.add(tableKey);
    }
    setExpandedTables(newExpanded);
  };

  const expandAll = () => {
    if (!catalog) return;
    const allTables = new Set();
    catalog.schemas.forEach(schema => {
      schema.tables.forEach(table => {
        allTables.add(`${schema.name}.${table.name}`);
      });
    });
    setExpandedTables(allTables);
  };

  const collapseAll = () => {
    setExpandedTables(new Set());
  };

  const getFilteredData = () => {
    if (!catalog) return [];

    let schemas = catalog.schemas;
    
    // Filter by schema
    if (selectedSchema !== 'all') {
      schemas = schemas.filter(s => s.name === selectedSchema);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      schemas = schemas.map(schema => ({
        ...schema,
        tables: schema.tables.filter(table => {
          const tableName = table.name.toLowerCase();
          const tableDesc = (table.details?.metadata?.description || '').toLowerCase();
          const hasMatchingColumn = table.details?.columns?.some(col =>
            col.name.toLowerCase().includes(query) ||
            (col.description || '').toLowerCase().includes(query)
          );
          return tableName.includes(query) || tableDesc.includes(query) || hasMatchingColumn;
        })
      })).filter(schema => schema.tables.length > 0);
    }

    return schemas;
  };

  const exportDictionary = () => {
    const filteredSchemas = getFilteredData();
    
    if (exportFormat === 'html') {
      exportAsHTML(filteredSchemas);
    } else if (exportFormat === 'csv') {
      exportAsCSV(filteredSchemas);
    } else if (exportFormat === 'markdown') {
      exportAsMarkdown(filteredSchemas);
    }
  };

  const exportAsHTML = (schemas) => {
    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Data Dictionary - ${catalog.connection_name || 'Database'}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
    h2 { color: #1e40af; margin-top: 30px; background: #dbeafe; padding: 10px; border-radius: 5px; }
    h3 { color: #1e3a8a; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
    tr:hover { background: #f9fafb; }
    .metadata { background: #eff6ff; padding: 10px; border-radius: 5px; margin: 10px 0; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 5px; }
    .badge-primary { background: #dbeafe; color: #1e40af; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-value { font-size: 24px; font-weight: bold; color: #2563eb; }
    .stat-label { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <h1>📚 Data Dictionary</h1>
  <p><strong>Database:</strong> ${catalog.connection_name || 'Unknown'}</p>
  <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
  
  <div class="stats">
    <div class="stat-card">
      <div class="stat-value">${schemas.reduce((sum, s) => sum + s.tables.length, 0)}</div>
      <div class="stat-label">Total Tables</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${schemas.reduce((sum, s) => sum + s.tables.reduce((tsum, t) => tsum + (t.details?.columns?.length || 0), 0), 0)}</div>
      <div class="stat-label">Total Columns</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${schemas.length}</div>
      <div class="stat-label">Schemas</div>
    </div>
  </div>
`;

    schemas.forEach(schema => {
      html += `\n  <h2>Schema: ${schema.name}</h2>`;
      
      schema.tables.forEach(table => {
        const metadata = table.details?.metadata || {};
        html += `\n  <h3>📋 ${table.name}</h3>`;
        
        if (metadata.description || metadata.owner || metadata.tags?.length) {
          html += `\n  <div class="metadata">`;
          if (metadata.description) {
            html += `\n    <p><strong>Description:</strong> ${metadata.description}</p>`;
          }
          if (metadata.owner) {
            html += `\n    <p><strong>Owner:</strong> ${metadata.owner}</p>`;
          }
          if (metadata.tags?.length) {
            html += `\n    <p><strong>Tags:</strong> `;
            metadata.tags.forEach(tag => {
              html += `<span class="badge badge-primary">${tag}</span>`;
            });
            html += `</p>`;
          }
          html += `\n  </div>`;
        }

        if (table.details?.columns?.length) {
          html += `\n  <table>`;
          html += `\n    <thead><tr><th>Column Name</th><th>Data Type</th><th>Nullable</th><th>Key</th><th>Description</th></tr></thead>`;
          html += `\n    <tbody>`;
          
          table.details.columns.forEach(col => {
            const isPK = table.details.primary_keys?.includes(col.name);
            const isFK = table.details.foreign_keys?.some(fk => fk.column === col.name);
            let keyBadge = '';
            if (isPK) keyBadge = '<span class="badge badge-warning">PK</span>';
            if (isFK) keyBadge += '<span class="badge badge-success">FK</span>';
            
            html += `\n      <tr>`;
            html += `\n        <td><strong>${col.name}</strong></td>`;
            html += `\n        <td>${col.data_type}</td>`;
            html += `\n        <td>${col.is_nullable ? 'Yes' : 'No'}</td>`;
            html += `\n        <td>${keyBadge}</td>`;
            html += `\n        <td>${col.description || '-'}</td>`;
            html += `\n      </tr>`;
          });
          
          html += `\n    </tbody>`;
          html += `\n  </table>`;
        }
      });
    });

    html += `\n</body>\n</html>`;

    downloadFile(html, 'data-dictionary.html', 'text/html');
  };

  const exportAsCSV = (schemas) => {
    let csv = 'Schema,Table,Column,Data Type,Nullable,Is Primary Key,Is Foreign Key,Description,Table Description,Owner,Tags\n';
    
    schemas.forEach(schema => {
      schema.tables.forEach(table => {
        const metadata = table.details?.metadata || {};
        const tableDesc = (metadata.description || '').replace(/"/g, '""');
        const owner = (metadata.owner || '').replace(/"/g, '""');
        const tags = (metadata.tags || []).join('; ');
        
        (table.details?.columns || []).forEach(col => {
          const isPK = table.details.primary_keys?.includes(col.name);
          const isFK = table.details.foreign_keys?.some(fk => fk.column === col.name);
          const colDesc = (col.description || '').replace(/"/g, '""');
          
          csv += `"${schema.name}","${table.name}","${col.name}","${col.data_type}",`;
          csv += `"${col.is_nullable ? 'Yes' : 'No'}","${isPK ? 'Yes' : 'No'}","${isFK ? 'Yes' : 'No'}",`;
          csv += `"${colDesc}","${tableDesc}","${owner}","${tags}"\n`;
        });
      });
    });

    downloadFile(csv, 'data-dictionary.csv', 'text/csv');
  };

  const exportAsMarkdown = (schemas) => {
    let md = `# 📚 Data Dictionary\n\n`;
    md += `**Database:** ${catalog.connection_name || 'Unknown'}\n`;
    md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    
    md += `## Summary\n\n`;
    md += `- **Schemas:** ${schemas.length}\n`;
    md += `- **Tables:** ${schemas.reduce((sum, s) => sum + s.tables.length, 0)}\n`;
    md += `- **Columns:** ${schemas.reduce((sum, s) => sum + s.tables.reduce((tsum, t) => tsum + (t.details?.columns?.length || 0), 0), 0)}\n\n`;

    schemas.forEach(schema => {
      md += `## Schema: ${schema.name}\n\n`;
      
      schema.tables.forEach(table => {
        const metadata = table.details?.metadata || {};
        md += `### 📋 ${table.name}\n\n`;
        
        if (metadata.description) {
          md += `**Description:** ${metadata.description}\n\n`;
        }
        if (metadata.owner) {
          md += `**Owner:** ${metadata.owner}\n\n`;
        }
        if (metadata.tags?.length) {
          md += `**Tags:** ${metadata.tags.join(', ')}\n\n`;
        }

        if (table.details?.columns?.length) {
          md += `| Column Name | Data Type | Nullable | Key | Description |\n`;
          md += `|-------------|-----------|----------|-----|-------------|\n`;
          
          table.details.columns.forEach(col => {
            const isPK = table.details.primary_keys?.includes(col.name);
            const isFK = table.details.foreign_keys?.some(fk => fk.column === col.name);
            let keyBadge = '';
            if (isPK) keyBadge = 'PK';
            if (isFK) keyBadge += (keyBadge ? ', FK' : 'FK');
            
            md += `| **${col.name}** | ${col.data_type} | ${col.is_nullable ? 'Yes' : 'No'} | ${keyBadge} | ${col.description || '-'} |\n`;
          });
          
          md += `\n`;
        }
      });
    });

    downloadFile(md, 'data-dictionary.md', 'text/markdown');
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading data dictionary...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  if (!catalog) {
    return null;
  }

  const filteredSchemas = getFilteredData();
  const totalTables = filteredSchemas.reduce((sum, s) => sum + s.tables.length, 0);
  const totalColumns = filteredSchemas.reduce((sum, s) => 
    sum + s.tables.reduce((tsum, t) => tsum + (t.details?.columns?.length || 0), 0), 0
  );

  const allSchemas = catalog.schemas.map(s => s.name);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-2">📚 Data Dictionary</h2>
          <p className="text-blue-100">
            Complete documentation of database tables, columns, and metadata
          </p>
        </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="text-3xl font-bold text-blue-600">{filteredSchemas.length}</div>
          <div className="text-sm text-gray-600">Schemas</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="text-3xl font-bold text-blue-600">{totalTables}</div>
          <div className="text-sm text-gray-600">Tables</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="text-3xl font-bold text-blue-600">{totalColumns}</div>
          <div className="text-sm text-gray-600">Columns</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="text-3xl font-bold text-blue-600">
            {catalog.schemas.reduce((sum, s) => 
              sum + s.tables.reduce((tsum, t) => tsum + (t.details?.foreign_keys?.length || 0), 0), 0
            )}
          </div>
          <div className="text-sm text-gray-600">Relationships</div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tables, columns..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Schema Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Schema
            </label>
            <select
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Schemas</option>
              {allSchemas.map(schema => (
                <option key={schema} value={schema}>{schema}</option>
              ))}
            </select>
          </div>

          {/* Export Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Export Format
            </label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="html">HTML Document</option>
              <option value="csv">CSV Spreadsheet</option>
              <option value="markdown">Markdown</option>
            </select>
          </div>

          {/* Export Button */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Actions
            </label>
            <button
              onClick={exportDictionary}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              📥 Export Dictionary
            </button>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={expandAll}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ▼ Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ▶ Collapse All
          </button>
        </div>
      </div>

      {/* Dictionary Content */}
      <div className="space-y-6">
        {filteredSchemas.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-600">No tables found matching your criteria.</p>
          </div>
        ) : (
          filteredSchemas.map(schema => (
            <div key={schema.name} className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Schema Header */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">
                  Schema: {schema.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {schema.tables.length} table{schema.tables.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Tables */}
              <div className="divide-y divide-gray-200">
                {schema.tables.map(table => {
                  const tableKey = `${schema.name}.${table.name}`;
                  const isExpanded = expandedTables.has(tableKey);
                  const metadata = table.details?.metadata || {};

                  return (
                    <div key={tableKey} className="p-6">
                      {/* Table Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleTableExpand(tableKey)}
                              className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                            <h4 className="text-lg font-bold text-gray-900">
                              {table.name}
                            </h4>
                            <span className="text-sm text-gray-500">
                              ({table.details?.columns?.length || 0} columns)
                            </span>
                          </div>
                          
                          {metadata.description && (
                            <p className="text-gray-700 mt-2 ml-8">{metadata.description}</p>
                          )}
                          
                          <div className="flex items-center gap-4 mt-2 ml-8 text-sm text-gray-600">
                            {metadata.owner && (
                              <span>👤 Owner: <strong>{metadata.owner}</strong></span>
                            )}
                            {metadata.tags && metadata.tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                🏷️ Tags:
                                {metadata.tags.map(tag => (
                                  <span
                                    key={tag}
                                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Columns Table */}
                      {isExpanded && table.details?.columns && (
                        <div className="ml-8 mt-4 overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Column Name
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Data Type
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Nullable
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Key
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Description
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {table.details.columns.map(col => {
                                const isPK = table.details.primary_keys?.includes(col.name);
                                const fkInfo = table.details.foreign_keys?.find(fk => fk.column === col.name);

                                return (
                                  <tr key={col.name} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="font-medium text-gray-900">{col.name}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                      {col.data_type}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                      {col.is_nullable ? (
                                        <span className="text-yellow-600">Yes</span>
                                      ) : (
                                        <span className="text-green-600">No</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {isPK && (
                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium mr-1">
                                          PK
                                        </span>
                                      )}
                                      {fkInfo && (
                                        <span
                                          className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium"
                                          title={`References ${fkInfo.referenced_table}.${fkInfo.referenced_column}`}
                                        >
                                          FK
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                      {col.description || (
                                        <span className="text-gray-400 italic">No description</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>

                          {/* Relationships Summary */}
                          {table.details.foreign_keys && table.details.foreign_keys.length > 0 && (
                            <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                              <h5 className="font-medium text-green-900 mb-2">🔗 Relationships</h5>
                              <ul className="space-y-1 text-sm text-green-800">
                                {table.details.foreign_keys.map((fk, idx) => (
                                  <li key={idx}>
                                    <code className="bg-green-100 px-2 py-1 rounded">{fk.column}</code>
                                    {' → '}
                                    <code className="bg-green-100 px-2 py-1 rounded">
                                      {fk.referenced_table}.{fk.referenced_column}
                                    </code>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}

export default DataDictionary;
