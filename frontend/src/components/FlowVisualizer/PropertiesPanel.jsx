import React, { useState, useEffect } from 'react';

function PropertiesPanel({ node, onUpdate, onDelete }) {
  const [formData, setFormData] = useState({
    label: '',
    description: '',
    transformationType: '',
    sqlSnippet: '',
    table: '',
    path: '',
    destinationType: '',
  });

  const [showSQLCode, setShowSQLCode] = useState(false);

  useEffect(() => {
    if (node) {
      setFormData({
        label: node.data.label || '',
        description: node.data.description || '',
        transformationType: node.data.transformationType || '',
        sqlSnippet: node.data.sqlSnippet || node.data.sqlCode || '',
        table: node.data.table || '',
        path: node.data.path || '',
        destinationType: node.data.destinationType || '',
      });
    }
  }, [node]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    onUpdate(node.id, { [field]: value });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this node?')) {
      onDelete(node.id);
    }
  };

  if (!node) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Properties</h2>
        <p className="text-xs text-gray-500">Select a node to view its properties</p>
      </div>
    );
  }

  const nodeType = node.data.type;

  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Properties</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Label
          </label>
          <input
            type="text"
            value={formData.label}
            onChange={(e) => handleChange('label', e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
          />
        </div>

        {nodeType === 'transformation' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Transformation Type
              </label>
              <select
                value={formData.transformationType}
                onChange={(e) => handleChange('transformationType', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
              >
                <option value="">Select type...</option>
                <option value="join">Join</option>
                <option value="filter">Filter</option>
                <option value="aggregate">Aggregate</option>
                <option value="union">Union</option>
                <option value="pivot">Pivot</option>
                <option value="custom">Custom SQL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                placeholder="Describe the transformation..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                SQL Snippet (optional)
              </label>
              <textarea
                value={formData.sqlSnippet}
                onChange={(e) => handleChange('sqlSnippet', e.target.value)}
                rows={4}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md font-mono"
                placeholder="Enter SQL code..."
              />
            </div>
          </>
        )}

        {nodeType === 'destination' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Destination Type
              </label>
              <div className="px-2 py-1 text-sm bg-gray-50 border border-gray-200 rounded-md">
                {formData.destinationType ? formData.destinationType.replace(/_/g, ' ').toUpperCase() : 'SQL TABLE'}
              </div>
            </div>

            {/* SQL Table and SSAS destinations */}
            {(formData.destinationType === 'sql_table_dest' || formData.destinationType === 'ssas_cube_dest' || !formData.destinationType) && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {formData.destinationType === 'ssas_cube_dest' ? 'Cube Name' : 'Destination Table'}
                </label>
                <input
                  type="text"
                  value={formData.table}
                  onChange={(e) => handleChange('table', e.target.value)}
                  placeholder={formData.destinationType === 'ssas_cube_dest' ? 'CubeName' : 'schema.table_name'}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                />
              </div>
            )}

            {/* File destinations (Excel, CSV) */}
            {(formData.destinationType === 'excel_dest' || formData.destinationType === 'csv_dest') && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  File Path
                </label>
                <input
                  type="text"
                  value={formData.path}
                  onChange={(e) => handleChange('path', e.target.value)}
                  placeholder={formData.destinationType === 'excel_dest' ? 'C:\\Reports\\output.xlsx' : 'C:\\Data\\output.csv'}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                />
              </div>
            )}

            {/* Power BI destination */}
            {formData.destinationType === 'powerbi_dest' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Dataset Name
                </label>
                <input
                  type="text"
                  value={formData.table}
                  onChange={(e) => handleChange('table', e.target.value)}
                  placeholder="PowerBIDataset"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                placeholder="Describe the destination..."
              />
            </div>
          </>
        )}

        {nodeType === 'source' && (
          <div>
            <div className="text-xs text-gray-500 mb-2">
              <strong>Schema:</strong> {node.data.schema}
            </div>
            <div className="text-xs text-gray-500 mb-2">
              <strong>Table:</strong> {node.data.tableName}
            </div>
            <div className="text-xs text-gray-400">
              Source tables are read-only. Drag from the Database Browser to add more.
            </div>
          </div>
        )}

        {/* SQL-Imported Nodes */}
        {(nodeType === 'table' || nodeType === 'cte' || nodeType === 'output' || 
          nodeType === 'column' || nodeType === 'join' || nodeType === 'filter') && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Node Type
              </label>
              <div className="px-2 py-1 text-sm bg-gray-50 border border-gray-200 rounded-md">
                {nodeType.toUpperCase()}
              </div>
            </div>

            {node.data.details && Object.keys(node.data.details).length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Details
                </label>
                <div className="px-2 py-2 text-xs bg-gray-50 border border-gray-200 rounded-md space-y-1">
                  {Object.entries(node.data.details).map(([key, value]) => (
                    <div key={key}>
                      <span className="font-semibold">{key}:</span>{' '}
                      <span className="text-gray-600">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(formData.sqlSnippet || node.data.sqlCode) && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center justify-between">
                  <span>SQL Code</span>
                  <button
                    onClick={() => setShowSQLCode(!showSQLCode)}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    {showSQLCode ? 'Hide' : 'Show'}
                  </button>
                </label>
                {showSQLCode && (
                  <textarea
                    value={formData.sqlSnippet}
                    onChange={(e) => handleChange('sqlSnippet', e.target.value)}
                    rows={8}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md font-mono bg-gray-50"
                    placeholder="SQL code..."
                  />
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                placeholder="Add notes about this node..."
              />
            </div>
          </>
        )}

        {nodeType === 'group' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={2}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
              placeholder="Describe this group..."
            />
          </div>
        )}

        {/* Delete Button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleDelete}
            className="w-full px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            🗑️ Delete Node
          </button>
        </div>
      </div>
    </div>
  );
}

export default PropertiesPanel;
