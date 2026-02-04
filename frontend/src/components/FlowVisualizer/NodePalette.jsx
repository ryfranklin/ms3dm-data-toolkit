import React, { useState } from 'react';

function NodePalette({ onAddTransformation, onAddDestination, onAddSource, onAddGroup }) {
  const [expandedCategories, setExpandedCategories] = useState({
    'SQL Server Sources': true,
    'Data Integration': true,
    'Database Destinations': true,
    'File Destinations': true,
    'BI & Reporting': true,
  });

  const sourceCategories = {
    'SQL Server Sources': [
      { id: 'sql_table', label: 'SQL Table', icon: '📊', description: 'SQL Server table data' },
      { id: 'sql_view', label: 'SQL View', icon: '👁️', description: 'SQL Server view' },
      { id: 'stored_proc', label: 'Stored Procedure', icon: '⚙️', description: 'Execute stored procedure' },
      { id: 'ssis_package', label: 'SSIS Package', icon: '📦', description: 'SQL Server Integration Services package' },
    ],
    'SSAS Sources': [
      { id: 'ssas_cube', label: 'SSAS Cube', icon: '🧊', description: 'Analysis Services cube' },
      { id: 'ssas_measure', label: 'Measure', icon: '📏', description: 'SSAS measure/calculation' },
      { id: 'ssas_dimension', label: 'Dimension', icon: '🔷', description: 'SSAS dimension' },
    ],
    'External Sources': [
      { id: 'excel', label: 'Excel File', icon: '📗', description: 'Excel workbook (.xlsx, .xls)' },
      { id: 's3', label: 'AWS S3', icon: '☁️', description: 'Amazon S3 bucket/file' },
      { id: 'csv', label: 'CSV File', icon: '📄', description: 'Comma-separated values file' },
      { id: 'azure_blob', label: 'Azure Blob', icon: '💠', description: 'Azure Blob Storage' },
    ],
  };

  const destinationCategories = {
    'Database Destinations': [
      { id: 'sql_table_dest', label: 'SQL Table', icon: '🗄️', description: 'SQL Server table destination' },
      { id: 'ssas_cube_dest', label: 'SSAS Cube', icon: '🧊', description: 'SQL Server Analysis Services cube' },
    ],
    'File Destinations': [
      { id: 'excel_dest', label: 'Excel File', icon: '📗', description: 'Export to Excel (.xlsx)' },
      { id: 'csv_dest', label: 'CSV File', icon: '📄', description: 'Export to CSV format' },
    ],
    'BI & Reporting': [
      { id: 'powerbi_dest', label: 'Power BI', icon: '📊', description: 'Load to Power BI dataset' },
    ],
  };

  const nodeCategories = {
    'Data Integration': [
      { id: 'join', label: 'Join', icon: '🔗', description: 'Combine rows from multiple tables' },
      { id: 'lookup', label: 'Lookup', icon: '🔎', description: 'Enrich data with reference table' },
      { id: 'merge', label: 'Merge', icon: '🔀', description: 'Combine multiple sources' },
      { id: 'union', label: 'Union', icon: '⬇️', description: 'Stack datasets vertically' },
    ],
    'Data Transformation': [
      { id: 'filter', label: 'Filter', icon: '🔍', description: 'Filter rows based on conditions' },
      { id: 'aggregate', label: 'Aggregate', icon: '📊', description: 'Summarize data (SUM, COUNT, etc.)' },
      { id: 'pivot', label: 'Pivot', icon: '↻', description: 'Rotate data from rows to columns' },
      { id: 'unpivot', label: 'Unpivot', icon: '↺', description: 'Rotate data from columns to rows' },
      { id: 'derived_column', label: 'Derived Column', icon: '➕', description: 'Add calculated columns' },
      { id: 'conditional_split', label: 'Conditional Split', icon: '🔱', description: 'Route rows to different paths' },
    ],
    'Data Quality': [
      { id: 'dedup', label: 'Remove Duplicates', icon: '🧹', description: 'Eliminate duplicate rows' },
      { id: 'validate', label: 'Data Validation', icon: '✓', description: 'Check data quality rules' },
      { id: 'cleanse', label: 'Data Cleansing', icon: '🧽', description: 'Clean and standardize data' },
      { id: 'null_handler', label: 'NULL Handler', icon: '⚠️', description: 'Handle NULL values' },
    ],
    'Data Shaping': [
      { id: 'select', label: 'Select Columns', icon: '📋', description: 'Choose specific columns' },
      { id: 'sort', label: 'Sort', icon: '⬆️', description: 'Order rows' },
      { id: 'distinct', label: 'Distinct', icon: '⭐', description: 'Get unique rows' },
      { id: 'sample', label: 'Sample Data', icon: '🎲', description: 'Get sample of rows' },
    ],
    'Advanced': [
      { id: 'window', label: 'Window Function', icon: '📈', description: 'Ranking, running totals, etc.' },
      { id: 'scd', label: 'SCD Type 2', icon: '🕐', description: 'Slowly Changing Dimension' },
      { id: 'custom', label: 'Custom SQL', icon: '💻', description: 'Write custom transformation' },
      { id: 'python', label: 'Python Script', icon: '🐍', description: 'Custom Python logic' },
    ],
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  return (
    <div className="p-4 overflow-y-auto">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">ETL Toolbox</h2>
      
      <div className="space-y-3">
        {/* SOURCE CATEGORIES */}
        <div className="pb-3 border-b border-gray-200">
          <div className="text-xs font-semibold text-blue-600 uppercase mb-2">Data Sources</div>
          {Object.entries(sourceCategories).map(([category, nodes]) => (
            <div key={category} className="mb-2">
              <button
                onClick={() => toggleCategory(category)}
                className="flex items-center w-full text-left mb-1"
              >
                <span className="text-xs mr-1">{expandedCategories[category] ? '▼' : '▶'}</span>
                <h3 className="text-xs font-medium text-gray-700">{category}</h3>
              </button>
              
              {expandedCategories[category] && (
                <div className="space-y-1 ml-2">
                  {nodes.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => onAddSource ? onAddSource(node.label, node.id) : onAddTransformation(node.label)}
                      className="w-full flex items-start px-2 py-1.5 text-xs bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 text-left group"
                      title={node.description}
                    >
                      <span className="mr-2 mt-0.5">{node.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{node.label}</div>
                        <div className="text-gray-500 text-[10px] mt-0.5 hidden group-hover:block">
                          {node.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* TRANSFORMATION CATEGORIES */}
        <div className="text-xs font-semibold text-yellow-600 uppercase mb-2">Transformations</div>
        {Object.entries(nodeCategories).map(([category, nodes]) => (
          <div key={category}>
            <button
              onClick={() => toggleCategory(category)}
              className="flex items-center w-full text-left mb-2"
            >
              <span className="text-xs mr-1">{expandedCategories[category] ? '▼' : '▶'}</span>
              <h3 className="text-xs font-medium text-gray-700 uppercase">{category}</h3>
            </button>
            
            {expandedCategories[category] && (
              <div className="space-y-1 ml-2">
                {nodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => onAddTransformation(node.label)}
                    className="w-full flex items-start px-2 py-1.5 text-xs bg-yellow-50 border border-yellow-200 rounded hover:bg-yellow-100 text-left group"
                    title={node.description}
                  >
                    <span className="mr-2 mt-0.5">{node.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{node.label}</div>
                      <div className="text-gray-500 text-[10px] mt-0.5 hidden group-hover:block">
                        {node.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="pt-2 border-t border-gray-200">
          <h3 className="text-xs font-medium text-gray-700 uppercase mb-2">Organization</h3>
          <button
            onClick={onAddGroup}
            className="w-full flex items-center px-2 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 text-left"
          >
            <span className="mr-2">📦</span>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Group Container</div>
              <div className="text-gray-500 text-[10px] mt-0.5">Organize related nodes</div>
            </div>
          </button>
        </div>

        {/* DESTINATION CATEGORIES */}
        <div className="pt-3 border-t border-gray-200">
          <div className="text-xs font-semibold text-green-600 uppercase mb-2">Data Destinations</div>
          {Object.entries(destinationCategories).map(([category, nodes]) => (
            <div key={category} className="mb-2">
              <button
                onClick={() => toggleCategory(category)}
                className="flex items-center w-full text-left mb-1"
              >
                <span className="text-xs mr-1">{expandedCategories[category] ? '▼' : '▶'}</span>
                <h3 className="text-xs font-medium text-gray-700">{category}</h3>
              </button>
              
              {expandedCategories[category] && (
                <div className="space-y-1 ml-2">
                  {nodes.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => onAddDestination ? onAddDestination(node.label, node.id) : onAddTransformation(node.label)}
                      className="w-full flex items-start px-2 py-1.5 text-xs bg-green-50 border border-green-200 rounded hover:bg-green-100 text-left group"
                      title={node.description}
                    >
                      <span className="mr-2 mt-0.5">{node.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{node.label}</div>
                        <div className="text-gray-500 text-[10px] mt-0.5 hidden group-hover:block">
                          {node.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NodePalette;
