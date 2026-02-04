import React, { useState, useEffect } from 'react';

function ConfigPanel({ expectation, onUpdate }) {
  const [formData, setFormData] = useState({
    column: '',
    params: {}
  });

  useEffect(() => {
    if (expectation) {
      setFormData({
        column: expectation.column || '',
        params: expectation.params || {}
      });
    }
  }, [expectation]);

  const handleColumnChange = (value) => {
    setFormData(prev => ({ ...prev, column: value }));
    onUpdate({ column: value });
  };

  const handleParamChange = (paramName, value) => {
    const newParams = { ...formData.params, [paramName]: value };
    setFormData(prev => ({ ...prev, params: newParams }));
    onUpdate({ params: newParams });
  };

  if (!expectation) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Configuration</h2>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">⚙️</div>
          <p className="text-xs text-gray-500">
            Select a check from the canvas to configure it
          </p>
        </div>
      </div>
    );
  }

  // Get parameter definitions from expectation
  const needsColumn = !expectation.type.includes('table_row_count');
  const paramDefs = getParamDefinitions(expectation.type);

  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Configuration</h2>
      
      <div className="space-y-4">
        {/* Check Info */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-2">{expectation.icon}</span>
            <h3 className="font-medium text-sm text-gray-900">{expectation.name}</h3>
          </div>
          <p className="text-xs text-gray-600">{expectation.description}</p>
        </div>

        {/* Column Input */}
        {needsColumn && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Column Name *
            </label>
            <input
              type="text"
              value={formData.column}
              onChange={(e) => handleColumnChange(e.target.value)}
              placeholder="e.g., CustomerID, Email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              The column to check
            </p>
          </div>
        )}

        {/* Dynamic Parameters */}
        {paramDefs.map((param) => (
          <div key={param.name}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {param.label} {param.required && '*'}
            </label>
            {param.type === 'number' ? (
              <input
                type="number"
                value={formData.params[param.name] || param.default || ''}
                onChange={(e) => handleParamChange(param.name, parseFloat(e.target.value))}
                placeholder={param.placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <input
                type="text"
                value={formData.params[param.name] || param.default || ''}
                onChange={(e) => handleParamChange(param.name, e.target.value)}
                placeholder={param.placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {param.description && (
              <p className="text-xs text-gray-500 mt-1">{param.description}</p>
            )}
          </div>
        ))}

        {/* Target Info */}
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Target</h4>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Schema:</span>
              <span className="font-mono">{expectation.target.schema}</span>
            </div>
            <div className="flex justify-between">
              <span>Table:</span>
              <span className="font-mono">{expectation.target.table}</span>
            </div>
          </div>
        </div>

        {/* Check Type */}
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Check Type</h4>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded block break-all">
            {expectation.type}
          </code>
        </div>
      </div>
    </div>
  );
}

// Helper function to get parameter definitions
function getParamDefinitions(expectationType) {
  const paramMaps = {
    'expect_column_values_to_be_between': [
      {
        name: 'min_value',
        label: 'Minimum Value',
        type: 'number',
        required: true,
        placeholder: '0',
        description: 'Minimum allowed value'
      },
      {
        name: 'max_value',
        label: 'Maximum Value',
        type: 'number',
        required: true,
        placeholder: '100',
        description: 'Maximum allowed value'
      }
    ],
    'expect_column_values_to_match_regex': [
      {
        name: 'regex',
        label: 'Pattern',
        type: 'string',
        required: true,
        placeholder: 'email|phone',
        description: 'Use "email" for email validation'
      }
    ],
    'expect_table_row_count_to_be_between': [
      {
        name: 'min_value',
        label: 'Minimum Rows',
        type: 'number',
        required: true,
        default: 0,
        description: 'Minimum expected row count'
      },
      {
        name: 'max_value',
        label: 'Maximum Rows',
        type: 'number',
        required: false,
        placeholder: '(optional)',
        description: 'Maximum expected row count (leave empty for no limit)'
      }
    ],
    'expect_column_values_to_be_recent': [
      {
        name: 'max_age_hours',
        label: 'Max Age (hours)',
        type: 'number',
        required: false,
        default: 24,
        description: 'Maximum age of data in hours'
      }
    ],
    'expect_column_values_to_be_valid_datekey': [
      {
        name: 'min_date',
        label: 'Minimum Date Key (optional)',
        type: 'number',
        required: false,
        placeholder: '20200101',
        description: 'Minimum valid date key (YYYYMMDD format, e.g., 20200101)'
      },
      {
        name: 'max_date',
        label: 'Maximum Date Key (optional)',
        type: 'number',
        required: false,
        placeholder: '20301231',
        description: 'Maximum valid date key (YYYYMMDD format, e.g., 20301231)'
      }
    ]
  };

  return paramMaps[expectationType] || [];
}

export default ConfigPanel;
