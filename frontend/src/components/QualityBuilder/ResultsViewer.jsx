import React, { useState } from 'react';

function ResultsViewer({ results, onClose }) {
  const [expanded, setExpanded] = useState(true);
  const [selectedResult, setSelectedResult] = useState(null);

  const getStatusColor = (success) => {
    return success ? 'text-green-600' : 'text-red-600';
  };

  const getStatusIcon = (success) => {
    return success ? '✓' : '✗';
  };

  const getStatusBg = (success) => {
    return success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  };

  // Guard against null/undefined results
  if (!results) {
    return null;
  }

  // Provide safe defaults for potentially missing properties
  const safeResults = {
    suite_name: results.suite_name || 'Unnamed Suite',
    status: results.status || 'unknown',
    statistics: results.statistics || { passed: 0, total_expectations: 0 },
    duration_seconds: results.duration_seconds || 0,
    results: results.results || []
  };

  return (
    <div className={`transition-all ${expanded ? 'h-96' : 'h-12'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-600 hover:text-gray-900"
          >
            {expanded ? '▼' : '▶'}
          </button>
          <h3 className="font-medium text-sm">
            Results: {safeResults.suite_name}
          </h3>
          <span className={`text-xs font-medium px-2 py-1 rounded ${
            safeResults.status === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {safeResults.status.toUpperCase()}
          </span>
          <span className="text-xs text-gray-600">
            {safeResults.statistics.passed}/{safeResults.statistics.total_expectations} passed
          </span>
          <span className="text-xs text-gray-500">
            {safeResults.duration_seconds}s
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {/* Results List */}
      {expanded && (
        <div className="h-full overflow-y-auto p-6">
          <div className="space-y-3">
            {safeResults.results.map((result, index) => (
              <div
                key={result.expectation_id}
                className={`border rounded-lg p-4 ${getStatusBg(result.success)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-lg font-bold ${getStatusColor(result.success)}`}>
                        {getStatusIcon(result.success)}
                      </span>
                      <span className="text-xs font-mono bg-white px-2 py-0.5 rounded">
                        #{index + 1}
                      </span>
                      <h4 className="font-medium text-sm">{result.expectation_name}</h4>
                      {result.column && (
                        <span className="text-xs bg-white px-2 py-0.5 rounded font-mono">
                          {result.column}
                        </span>
                      )}
                    </div>

                    {/* Observed Values */}
                    {result.observed_value && typeof result.observed_value === 'object' && (
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {Object.entries(result.observed_value).filter(([key, value]) => value !== undefined).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="text-gray-600">{formatKey(key)}:</span>
                            <span className="ml-1 font-medium text-gray-900">
                              {formatValue(key, value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Valid Samples (for date key conversions) */}
                    {result.valid_samples && Array.isArray(result.valid_samples) && result.valid_samples.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-green-700 mb-2">
                          ✓ Valid Date Key Conversions (sample):
                        </div>
                        <div className="p-2 bg-green-50 rounded border border-green-200">
                          <div className="space-y-1">
                            {result.valid_samples.map((sample, idx) => (
                              <div key={idx} className="text-xs flex items-center justify-between">
                                <span className="font-mono text-gray-700">
                                  {sample?.datekey_value ?? 'N/A'}
                                </span>
                                <span className="text-gray-500 mx-2">→</span>
                                <span className="font-medium text-green-700">
                                  {sample?.formatted_date ?? 'N/A'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Failed Samples */}
                    {result.failed_samples && Array.isArray(result.failed_samples) && result.failed_samples.length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() => setSelectedResult(
                            selectedResult === result.expectation_id ? null : result.expectation_id
                          )}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedResult === result.expectation_id ? '▼' : '▶'} 
                          {' '}View {result.failed_samples.length} failed sample(s)
                        </button>
                        
                        {selectedResult === result.expectation_id && (
                          <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {result.failed_samples.map((sample, idx) => (
                                <div key={idx} className="text-xs font-mono text-gray-700">
                                  {sample ? JSON.stringify(sample) : 'N/A'}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error */}
                    {result.error && (
                      <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded">
                        <p className="text-xs text-red-800">Error: {result.error}</p>
                      </div>
                    )}

                    {/* Details */}
                    {result.details && Object.keys(result.details).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(result.details).map(([key, value]) => (
                            <span key={key} className="text-xs bg-white px-2 py-1 rounded">
                              {formatKey(key)}: <span className="font-medium">{value}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 ml-4">
                    {result.execution_time_ms}ms
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Summary</h4>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {results.statistics.total_expectations}
                </div>
                <div className="text-xs text-gray-600">Total Checks</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {results.statistics.passed}
                </div>
                <div className="text-xs text-gray-600">Passed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {results.statistics.failed}
                </div>
                <div className="text-xs text-gray-600">Failed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600">
                  {results.duration_seconds}s
                </div>
                <div className="text-xs text-gray-600">Duration</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function formatKey(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function formatValue(key, value) {
  // Handle null/undefined values
  if (value === null || value === undefined) {
    return 'N/A';
  }
  
  if (key.includes('percentage')) {
    return `${value}%`;
  }
  if (key.includes('count') || key.includes('rows')) {
    return typeof value === 'number' ? value.toLocaleString() : value;
  }
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return value;
}

export default ResultsViewer;
