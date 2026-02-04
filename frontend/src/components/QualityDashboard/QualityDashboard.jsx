import React, { useState, useEffect } from 'react';
import { configApi, qualityApi } from '../../api/client';

function QualityDashboard() {
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState('');
  const [checkTypes, setCheckTypes] = useState({
    null_analysis: true,
    schema_validation: false,
    gap_detection: false,
    freshness: false,
    data_profiling: false,
  });
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState(null);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [configJson, setConfigJson] = useState(JSON.stringify({
    expected_schema: {
      'SalesLT.Customer': {
        'CustomerID': { 'type': 'int' },
        'FirstName': { 'type': 'nvarchar' },
        'LastName': { 'type': 'nvarchar' },
        'EmailAddress': { 'type': 'nvarchar' }
      }
    },
    sequence_columns: {
      'SalesLT.SalesOrderHeader': ['SalesOrderID'],
      'SalesLT.Product': ['ProductID']
    },
    null_threshold: 0.1,
    freshness_threshold_hours: 24,
    freshness_columns: {
      'SalesLT.SalesOrderHeader': {
        'ModifiedDate': 48
      }
    }
  }, null, 2));

  useEffect(() => {
    loadConnections();
    loadHistory();
  }, []);

  // Load saved config when connection changes
  useEffect(() => {
    if (selectedConnection) {
      loadSavedConfig();
    }
  }, [selectedConnection]);

  const loadConnections = async () => {
    try {
      const data = await configApi.getConnections();
      setConnections(data.connections || []);
      if (data.connections && data.connections.length > 0) {
        setSelectedConnection(data.connections[0].id);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await qualityApi.getHistory();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const loadSavedConfig = async () => {
    try {
      const data = await qualityApi.loadConfig(selectedConnection);
      if (data.config) {
        // Saved config exists, use it
        setConfigJson(JSON.stringify(data.config, null, 2));
      }
      // If no saved config, keep the default
    } catch (err) {
      console.error('Failed to load saved config:', err);
    }
  };

  const handleGenerateConfig = async () => {
    if (!selectedConnection) {
      setError('Please select a connection first');
      return;
    }

    try {
      setError(null);
      const data = await qualityApi.generateConfig(selectedConnection);
      setConfigJson(JSON.stringify(data.config, null, 2));
      setError(null);
      // Show success message
      alert('Configuration generated successfully from database schema!');
    } catch (err) {
      setError(`Failed to generate config: ${err.message}`);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedConnection) {
      setError('Please select a connection first');
      return;
    }

    // Validate JSON first
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(configJson);
    } catch (e) {
      setError(`Invalid JSON: ${e.message}`);
      return;
    }

    try {
      setError(null);
      await qualityApi.saveConfig(selectedConnection, parsedConfig);
      alert('Configuration saved successfully!');
    } catch (err) {
      setError(`Failed to save config: ${err.message}`);
    }
  };

  const handleCheckTypeChange = (type) => {
    setCheckTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleRunChecks = async () => {
    if (!selectedConnection) {
      setError('Please select a connection');
      return;
    }

    const selectedTypes = Object.keys(checkTypes).filter(key => checkTypes[key]);
    if (selectedTypes.length === 0) {
      setError('Please select at least one check type');
      return;
    }

    // Parse configuration JSON
    let parsedConfig = {};
    try {
      parsedConfig = JSON.parse(configJson);
    } catch (e) {
      setError(`Invalid JSON configuration: ${e.message}`);
      return;
    }

    try {
      setRunning(true);
      setError(null);
      const data = await qualityApi.runChecks({
        connection_id: selectedConnection,
        check_types: selectedTypes,
        tables: [],
        config: parsedConfig,
      });

      // Load full results
      const fullResults = await qualityApi.getResults(data.check_id);
      setResults(fullResults);
      setActiveTab('overview');
      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const loadHistoricalResults = async (checkId) => {
    try {
      const data = await qualityApi.getResults(checkId);
      setResults(data);
      setActiveTab('overview');
    } catch (err) {
      setError(err.message);
    }
  };

  const calculateHealthScore = () => {
    if (!results || !results.summary) return 0;
    
    let totalIssues = 0;
    let totalChecks = 0;
    
    Object.values(results.summary).forEach(check => {
      if (check.total_columns) {
        totalChecks += check.total_columns;
        totalIssues += check.columns_with_issues || 0;
      }
      if (check.total_tables) {
        totalChecks += check.total_tables;
        totalIssues += check.tables_with_issues || 0;
      }
    });
    
    return totalChecks > 0 ? Math.round((1 - totalIssues / totalChecks) * 100) : 100;
  };

  const getSeverityColor = (percentage) => {
    if (percentage >= 90) return 'text-green-600 bg-green-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    if (percentage >= 50) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getSeverityBadge = (issueCount) => {
    if (issueCount === 0) return { label: 'Excellent', color: 'bg-green-100 text-green-800', icon: '✓' };
    if (issueCount <= 5) return { label: 'Good', color: 'bg-blue-100 text-blue-800', icon: 'ℹ' };
    if (issueCount <= 10) return { label: 'Warning', color: 'bg-yellow-100 text-yellow-800', icon: '⚠' };
    return { label: 'Critical', color: 'bg-red-100 text-red-800', icon: '⨯' };
  };

  const renderOverview = () => {
    if (!results || !results.summary) return null;

    const summary = results.summary;
    const healthScore = calculateHealthScore();

    return (
      <div className="space-y-6">
        {/* Health Score Card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden shadow-lg rounded-lg border-2 border-blue-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Overall Data Health</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(results.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full text-3xl font-bold ${getSeverityColor(healthScore)} border-4 ${healthScore >= 90 ? 'border-green-600' : healthScore >= 70 ? 'border-yellow-600' : 'border-red-600'}`}>
                  {healthScore}
                </div>
                <p className="text-xs text-gray-600 mt-2">Health Score</p>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Quality Progress</span>
                <span>{healthScore}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${healthScore >= 90 ? 'bg-green-500' : healthScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${healthScore}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Metrics Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {summary.null_analysis && (
            <div className="bg-white overflow-hidden shadow-lg rounded-lg border-l-4 border-purple-500 hover:shadow-xl transition-shadow">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      NULL Analysis
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-3xl font-semibold text-gray-900">
                        {summary.null_analysis.columns_with_issues}
                      </div>
                      <div className="ml-2 text-sm text-gray-500">
                        / {summary.null_analysis.total_columns}
                      </div>
                    </dd>
                    <dd className="mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityBadge(summary.null_analysis.columns_with_issues).color}`}>
                        {getSeverityBadge(summary.null_analysis.columns_with_issues).icon} {getSeverityBadge(summary.null_analysis.columns_with_issues).label}
                      </span>
                    </dd>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ width: `${((summary.null_analysis.total_columns - summary.null_analysis.columns_with_issues) / summary.null_analysis.total_columns) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {summary.schema_validation && (
            <div className="bg-white overflow-hidden shadow-lg rounded-lg border-l-4 border-blue-500 hover:shadow-xl transition-shadow">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                    <span className="text-2xl">📋</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Schema Validation
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-3xl font-semibold text-gray-900">
                        {summary.schema_validation.tables_with_issues}
                      </div>
                      <div className="ml-2 text-sm text-gray-500">
                        / {summary.schema_validation.total_tables}
                      </div>
                    </dd>
                    <dd className="mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityBadge(summary.schema_validation.tables_with_issues).color}`}>
                        {getSeverityBadge(summary.schema_validation.tables_with_issues).icon} {getSeverityBadge(summary.schema_validation.tables_with_issues).label}
                      </span>
                    </dd>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${((summary.schema_validation.total_tables - summary.schema_validation.tables_with_issues) / summary.schema_validation.total_tables) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {summary.gap_detection && (
            <div className="bg-white overflow-hidden shadow-lg rounded-lg border-l-4 border-orange-500 hover:shadow-xl transition-shadow">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-orange-100 rounded-md p-3">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Data Gaps & Duplicates
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-3xl font-semibold text-gray-900">
                        {summary.gap_detection.tables_with_gaps + summary.gap_detection.tables_with_duplicates}
                      </div>
                      <div className="ml-2 text-sm text-gray-500">
                        issues
                      </div>
                    </dd>
                    <dd className="mt-2 flex gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        {summary.gap_detection.tables_with_gaps} gaps
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        {summary.gap_detection.tables_with_duplicates} dupes
                      </span>
                    </dd>
                  </div>
                </div>
              </div>
            </div>
          )}

          {summary.freshness && (
            <div className="bg-white overflow-hidden shadow-lg rounded-lg border-l-4 border-green-500 hover:shadow-xl transition-shadow">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                    <span className="text-2xl">⏰</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Data Freshness
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-3xl font-semibold text-gray-900">
                        {summary.freshness.tables_with_stale_data}
                      </div>
                      <div className="ml-2 text-sm text-gray-500">
                        / {summary.freshness.total_tables}
                      </div>
                    </dd>
                    <dd className="mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityBadge(summary.freshness.tables_with_stale_data).color}`}>
                        {getSeverityBadge(summary.freshness.tables_with_stale_data).icon} {getSeverityBadge(summary.freshness.tables_with_stale_data).label}
                      </span>
                    </dd>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${((summary.freshness.total_tables - summary.freshness.tables_with_stale_data) / summary.freshness.total_tables) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const [expandedTables, setExpandedTables] = useState({});

  const toggleTableExpansion = (tableName) => {
    setExpandedTables(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }));
  };

  const getNullPercentageColor = (percentage) => {
    if (percentage === 0) return 'bg-green-500';
    if (percentage < 10) return 'bg-blue-500';
    if (percentage < 30) return 'bg-yellow-500';
    if (percentage < 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const renderNullAnalysis = () => {
    if (!results || !results.details || !results.details.null_analysis) return null;

    const nullData = results.details.null_analysis;

    return (
      <div className="space-y-4">
        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border-2 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-900">Total Tables</p>
                <p className="text-2xl font-bold text-purple-700">{Object.keys(nullData).length}</p>
              </div>
              <span className="text-3xl">📊</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">Total Columns</p>
                <p className="text-2xl font-bold text-blue-700">
                  {Object.values(nullData).reduce((sum, table) => sum + (table.columns?.length || 0), 0)}
                </p>
              </div>
              <span className="text-3xl">📋</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border-2 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-900">Total Issues</p>
                <p className="text-2xl font-bold text-red-700">
                  {Object.values(nullData).reduce((sum, table) => sum + (table.issues_found || 0), 0)}
                </p>
              </div>
              <span className="text-3xl">⚠️</span>
            </div>
          </div>
        </div>

        {/* Detailed Tables */}
        {Object.entries(nullData).map(([tableName, tableData]) => {
          const issueCount = tableData.issues_found || 0;
          const isExpanded = expandedTables[tableName];
          
          return (
            <div key={tableName} className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
              <div 
                className="px-4 py-4 sm:px-6 bg-gradient-to-r from-gray-50 to-gray-100 cursor-pointer hover:from-gray-100 hover:to-gray-200 transition-colors"
                onClick={() => toggleTableExpansion(tableName)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{isExpanded ? '▼' : '▶'}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{tableName}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-gray-600">
                          📊 {tableData.total_rows?.toLocaleString()} rows
                        </span>
                        <span className="text-sm text-gray-600">
                          📋 {tableData.columns?.length || 0} columns
                        </span>
                        {issueCount > 0 && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityBadge(issueCount).color}`}>
                            {getSeverityBadge(issueCount).icon} {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
                          </span>
                        )}
                        {issueCount === 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ No issues
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold ${getSeverityColor(((tableData.columns?.length - issueCount) / tableData.columns?.length) * 100)}`}>
                      {Math.round(((tableData.columns?.length - issueCount) / tableData.columns?.length) * 100)}
                    </div>
                  </div>
                </div>
              </div>
              
              {isExpanded && tableData.columns && tableData.columns.length > 0 && (
                <div className="px-4 py-4 sm:p-6 bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Column</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nullable</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NULL Count</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NULL %</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visual</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tableData.columns
                          .sort((a, b) => (b.null_percentage || 0) - (a.null_percentage || 0))
                          .map((col, idx) => (
                          <tr key={idx} className={`${col.is_issue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'} transition-colors`}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="text-sm font-medium text-gray-900">{col.column}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-700">
                                {col.data_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {col.is_nullable === 'YES' ? (
                                <span className="text-blue-600">✓ Yes</span>
                              ) : (
                                <span className="text-gray-400">✗ No</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {(col.null_count || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                              {(col.null_percentage || 0).toFixed(2)}%
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="w-24 bg-gray-200 rounded-full h-2.5">
                                <div
                                  className={`h-2.5 rounded-full ${getNullPercentageColor(col.null_percentage || 0)}`}
                                  style={{ width: `${Math.min(col.null_percentage || 0, 100)}%` }}
                                  title={`${col.null_percentage}% NULL values`}
                                ></div>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {col.is_issue ? (
                                <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                                  ⚠ Issue
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                                  ✓ OK
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSchemaValidation = () => {
    if (!results || !results.details || !results.details.schema_validation) return null;

    const schemaData = results.details.schema_validation;

    return (
      <div className="space-y-4">
        {Object.entries(schemaData).map(([tableName, tableData]) => {
          const issueCount = tableData.issues?.length || 0;
          const isExpanded = expandedTables[tableName];

          return (
            <div key={tableName} className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
              <div 
                className="px-4 py-4 sm:px-6 bg-gradient-to-r from-blue-50 to-blue-100 cursor-pointer hover:from-blue-100 hover:to-blue-200 transition-colors"
                onClick={() => toggleTableExpansion(tableName)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{isExpanded ? '▼' : '▶'}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{tableName}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        {issueCount > 0 ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityBadge(issueCount).color}`}>
                            {getSeverityBadge(issueCount).icon} {issueCount} schema {issueCount === 1 ? 'issue' : 'issues'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Schema valid
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded && tableData.issues && tableData.issues.length > 0 && (
                <div className="px-4 py-4 bg-white">
                  <div className="space-y-2">
                    {tableData.issues.map((issue, idx) => (
                      <div key={idx} className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                        <p className="text-sm text-gray-800">{issue}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderGapDetection = () => {
    if (!results || !results.details || !results.details.gap_detection) return null;

    const gapData = results.details.gap_detection;

    return (
      <div className="space-y-4">
        {Object.entries(gapData).map(([tableName, tableData]) => {
          // Count issues
          const sequenceGaps = tableData.sequence_gaps || [];
          const duplicateChecks = tableData.duplicate_checks || [];
          
          const hasSequenceGaps = sequenceGaps.some(sg => sg.is_issue);
          const hasDuplicates = duplicateChecks.some(dc => dc.is_issue);
          const totalGaps = sequenceGaps.reduce((sum, sg) => sum + (sg.gaps_found || 0), 0);
          const totalDuplicates = duplicateChecks.reduce((sum, dc) => sum + (dc.duplicates_found || 0), 0);
          
          const isExpanded = expandedTables[tableName];

          return (
            <div key={tableName} className={`bg-white shadow-lg rounded-lg overflow-hidden border-2 ${
              hasDuplicates ? 'border-red-300' : hasSequenceGaps ? 'border-orange-300' : 'border-green-300'
            }`}>
              <div 
                className={`px-4 py-4 sm:px-6 cursor-pointer transition-colors ${
                  hasDuplicates 
                    ? 'bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200' 
                    : hasSequenceGaps 
                      ? 'bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200' 
                      : 'bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200'
                }`}
                onClick={() => toggleTableExpansion(tableName)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="text-xl">{isExpanded ? '▼' : '▶'}</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{tableName}</h3>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {hasDuplicates && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                            🚨 {totalDuplicates} duplicate {totalDuplicates === 1 ? 'value' : 'values'}
                          </span>
                        )}
                        {hasSequenceGaps && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
                            ⚠️ {totalGaps} gap {totalGaps === 1 ? 'range' : 'ranges'}
                          </span>
                        )}
                        {!hasSequenceGaps && !hasDuplicates && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                            ✅ No gaps or duplicates detected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-3xl ${
                      hasDuplicates ? 'bg-red-100' : hasSequenceGaps ? 'bg-orange-100' : 'bg-green-100'
                    }`}>
                      {hasDuplicates ? '🚨' : hasSequenceGaps ? '⚠️' : '✅'}
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-6 py-6 bg-white space-y-6">
                  {/* Duplicate Primary Keys Section */}
                  {duplicateChecks.length > 0 && (
                    <div>
                      <h4 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="text-xl">🔑</span> Primary Key Duplicates
                      </h4>
                      <div className="space-y-4">
                        {duplicateChecks.map((check, idx) => (
                          <div key={idx} className={`rounded-lg overflow-hidden border-2 ${
                            check.is_issue ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'
                          }`}>
                            <div className={`px-4 py-3 ${check.is_issue ? 'bg-red-100' : 'bg-green-100'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-lg">{check.is_issue ? '❌' : '✓'}</span>
                                  <div>
                                    <p className="font-mono font-semibold text-gray-900">{check.column}</p>
                                    <p className="text-xs text-gray-600 mt-0.5">Primary Key Column</p>
                                  </div>
                                </div>
                                {check.is_issue && (
                                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-200 text-red-900">
                                    {check.duplicates_found} duplicate {check.duplicates_found === 1 ? 'value' : 'values'}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {check.is_issue && check.duplicate_values && check.duplicate_values.length > 0 && (
                              <div className="px-4 py-4 bg-white">
                                <p className="text-sm font-semibold text-gray-700 mb-3">
                                  Duplicate Values (Top {check.duplicate_values.length}):
                                </p>
                                <div className="space-y-2">
                                  {check.duplicate_values.map((dup, dupIdx) => (
                                    <div key={dupIdx} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                                      <div className="flex items-center gap-2">
                                        <span className="text-red-600 font-bold">⚠️</span>
                                        <span className="font-mono text-sm font-semibold text-gray-900">{dup.value}</span>
                                      </div>
                                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-200 text-red-900">
                                        appears {dup.count} times
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {check.duplicates_found > check.duplicate_values.length && (
                                  <p className="text-xs text-gray-500 mt-3 italic">
                                    ... and {check.duplicates_found - check.duplicate_values.length} more duplicate value(s)
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sequence Gaps Section */}
                  {sequenceGaps.length > 0 && (
                    <div>
                      <h4 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="text-xl">📊</span> Sequence Gap Analysis
                      </h4>
                      <div className="space-y-4">
                        {sequenceGaps.map((gap, idx) => (
                          <div key={idx} className={`rounded-lg overflow-hidden border-2 ${
                            gap.is_issue ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50'
                          }`}>
                            <div className={`px-4 py-3 ${gap.is_issue ? 'bg-orange-100' : 'bg-green-100'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-lg">{gap.is_issue ? '⚠️' : '✓'}</span>
                                  <div>
                                    <p className="font-mono font-semibold text-gray-900">{gap.column}</p>
                                    <p className="text-xs text-gray-600 mt-0.5">Sequence Column</p>
                                  </div>
                                </div>
                                {gap.is_issue && (
                                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-200 text-orange-900">
                                    {gap.total_missing || gap.gaps_found} missing
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Statistics Row */}
                            {gap.min_value !== null && gap.max_value !== null && (
                              <div className="px-4 py-3 bg-white border-b border-gray-200">
                                <div className="grid grid-cols-4 gap-4 text-center">
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Min Value</p>
                                    <p className="font-mono font-bold text-gray-900">{gap.min_value?.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Max Value</p>
                                    <p className="font-mono font-bold text-gray-900">{gap.max_value?.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Actual Count</p>
                                    <p className="font-mono font-bold text-blue-700">{gap.actual_count?.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Missing</p>
                                    <p className="font-mono font-bold text-orange-700">{gap.total_missing?.toLocaleString() || 0}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {gap.is_issue && gap.gap_ranges && gap.gap_ranges.length > 0 && (
                              <div className="px-4 py-4 bg-white">
                                <p className="text-sm font-semibold text-gray-700 mb-3">
                                  Gap Ranges (Top {gap.gap_ranges.length} by size):
                                </p>
                                <div className="space-y-2">
                                  {gap.gap_ranges.map((range, rangeIdx) => (
                                    <div key={rangeIdx} className="p-3 bg-orange-50 border-l-4 border-orange-400 rounded-lg">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <span className="text-orange-600 font-bold text-lg">📉</span>
                                          <div>
                                            <p className="text-sm font-medium text-gray-900">
                                              Gap from <span className="font-mono font-bold text-orange-700">{range.start?.toLocaleString()}</span>
                                              {' '} to <span className="font-mono font-bold text-orange-700">{range.end?.toLocaleString()}</span>
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1">
                                              Missing values: {range.start + 1} through {range.end - 1}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-200 text-orange-900 whitespace-nowrap">
                                          {range.missing_count} missing
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {gap.gaps_found > gap.gap_ranges.length && (
                                  <p className="text-xs text-gray-500 mt-3 italic">
                                    ... and {gap.gaps_found - gap.gap_ranges.length} more gap range(s)
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No issues detected */}
                  {duplicateChecks.length === 0 && sequenceGaps.length === 0 && (
                    <div className="text-center py-8">
                      <span className="text-6xl">✅</span>
                      <p className="mt-3 text-gray-600 font-medium">No duplicate or gap checks configured for this table</p>
                      <p className="mt-1 text-sm text-gray-500">Primary key duplicates are checked automatically. Configure sequence_columns for gap detection.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderFreshness = () => {
    if (!results || !results.details || !results.details.freshness) return null;

    const freshnessData = results.details.freshness;

    return (
      <div className="space-y-4">
        {Object.entries(freshnessData).map(([tableName, tableData]) => {
          const staleColumns = tableData.stale_columns || 0;
          const totalColumns = tableData.columns?.length || 0;
          const hasStaleData = staleColumns > 0;
          const isExpanded = expandedTables[tableName];
          const freshnessPercentage = totalColumns > 0 ? ((totalColumns - staleColumns) / totalColumns) * 100 : 100;

          return (
            <div key={tableName} className={`bg-white shadow-lg rounded-lg overflow-hidden border-2 ${hasStaleData ? 'border-red-300' : 'border-green-300'}`}>
              <div 
                className={`px-4 py-4 sm:px-6 bg-gradient-to-r ${hasStaleData ? 'from-red-50 to-red-100' : 'from-green-50 to-green-100'} cursor-pointer hover:${hasStaleData ? 'from-red-100 to-red-200' : 'from-green-100 to-green-200'} transition-colors`}
                onClick={() => toggleTableExpansion(tableName)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="text-xl">{isExpanded ? '▼' : '▶'}</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{tableName}</h3>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm text-gray-600">
                          📅 {totalColumns} datetime {totalColumns === 1 ? 'column' : 'columns'}
                        </span>
                        {hasStaleData ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            ⚠ {staleColumns} stale
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ All fresh
                          </span>
                        )}
                      </div>
                      {/* Freshness Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Freshness Score</span>
                          <span className="font-semibold">{Math.round(freshnessPercentage)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${freshnessPercentage >= 90 ? 'bg-green-500' : freshnessPercentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${freshnessPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold ${hasStaleData ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {hasStaleData ? '🕐' : '✓'}
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded && tableData.columns && tableData.columns.length > 0 && (
                <div className="px-4 py-4 bg-white">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span>📊</span> Datetime Columns Freshness Details
                  </h4>
                  <div className="space-y-3">
                    {tableData.columns.map((col, idx) => {
                      const isStale = col.is_stale;
                      const ageHours = col.age_hours || 0;
                      const threshold = col.threshold_hours || 24;
                      const percentOfThreshold = (ageHours / threshold) * 100;
                      
                      return (
                        <div 
                          key={idx} 
                          className={`p-4 rounded-lg border-2 ${isStale ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono font-semibold text-gray-900">{col.column}</span>
                                {isStale ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    ⚠ Stale
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    ✓ Fresh
                                  </span>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                <div className="bg-white p-2 rounded border border-gray-200">
                                  <dt className="text-xs font-medium text-gray-500">Last Update</dt>
                                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                                    {col.max_date ? new Date(col.max_date).toLocaleString() : 'No data'}
                                  </dd>
                                </div>
                                
                                <div className="bg-white p-2 rounded border border-gray-200">
                                  <dt className="text-xs font-medium text-gray-500">Age</dt>
                                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                                    {ageHours !== null ? (
                                      <>
                                        {ageHours < 1 ? (
                                          <span className="text-green-600">{(ageHours * 60).toFixed(0)} min</span>
                                        ) : ageHours < 24 ? (
                                          <span>{ageHours.toFixed(1)} hrs</span>
                                        ) : (
                                          <span>{(ageHours / 24).toFixed(1)} days</span>
                                        )}
                                      </>
                                    ) : 'N/A'}
                                  </dd>
                                </div>
                                
                                <div className="bg-white p-2 rounded border border-gray-200">
                                  <dt className="text-xs font-medium text-gray-500">Threshold</dt>
                                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                                    {threshold < 24 ? `${threshold} hrs` : `${(threshold / 24).toFixed(0)} days`}
                                  </dd>
                                </div>
                              </div>

                              {/* Age vs Threshold Bar */}
                              {ageHours !== null && (
                                <div>
                                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                    <span>Age relative to threshold</span>
                                    <span className={`font-semibold ${percentOfThreshold > 100 ? 'text-red-600' : percentOfThreshold > 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                                      {Math.round(percentOfThreshold)}%
                                    </span>
                                  </div>
                                  <div className="relative w-full bg-gray-200 rounded-full h-3">
                                    <div
                                      className={`h-3 rounded-full transition-all duration-500 ${
                                        percentOfThreshold > 100 ? 'bg-red-500' : 
                                        percentOfThreshold > 80 ? 'bg-yellow-500' : 
                                        percentOfThreshold > 50 ? 'bg-blue-500' : 
                                        'bg-green-500'
                                      }`}
                                      style={{ width: `${Math.min(percentOfThreshold, 100)}%` }}
                                    ></div>
                                    {/* Threshold marker at 100% */}
                                    <div className="absolute top-0 right-0 h-3 w-0.5 bg-gray-600"></div>
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Now</span>
                                    <span>Threshold ({threshold}h)</span>
                                  </div>
                                </div>
                              )}

                              {/* Time until stale or overdue */}
                              {ageHours !== null && (
                                <div className="mt-2 text-xs">
                                  {isStale ? (
                                    <p className="text-red-600 font-medium">
                                      ⏰ Overdue by {(ageHours - threshold).toFixed(1)} hours
                                    </p>
                                  ) : (
                                    <p className="text-green-600 font-medium">
                                      ✓ {(threshold - ageHours).toFixed(1)} hours until threshold
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {tableData.status === 'no_datetime_columns' && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        ⚠️ No datetime columns found in this table. Freshness cannot be determined.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderDataProfiling = () => {
    if (!results || !results.details || !results.details.data_profiling) return null;

    const profilingData = results.details.data_profiling;

    return (
      <div className="space-y-4">
        {Object.entries(profilingData).map(([tableName, tableData]) => {
          if (tableData.status !== 'profiled') return null;
          const isExpanded = expandedTables[tableName];

          return (
            <div key={tableName} className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
              <div 
                className="px-4 py-4 sm:px-6 bg-gradient-to-r from-indigo-50 to-indigo-100 cursor-pointer hover:from-indigo-100 hover:to-indigo-200 transition-colors"
                onClick={() => toggleTableExpansion(tableName)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="text-xl">{isExpanded ? '▼' : '▶'}</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{tableName}</h3>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm text-gray-600">
                          📊 {tableData.total_rows?.toLocaleString()} rows
                        </span>
                        <span className="text-sm text-gray-600">
                          📋 {tableData.total_columns} columns
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          ✓ Profiled
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold bg-indigo-100 text-indigo-600">
                      📈
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded && tableData.columns && tableData.columns.length > 0 && (
                <div className="px-4 py-4 bg-white">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span>📊</span> Column Profiles
                  </h4>
                  <div className="space-y-6">
                    {tableData.columns.map((col, idx) => {
                      const profileType = col.profile_type;
                      
                      return (
                        <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          {/* Column Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-gray-900">{col.column}</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
                                {col.data_type}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                profileType === 'numeric' ? 'bg-blue-100 text-blue-800' :
                                profileType === 'string' ? 'bg-purple-100 text-purple-800' :
                                profileType === 'datetime' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {profileType}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              {col.completeness !== undefined && (
                                <span className="font-medium">{col.completeness}% complete</span>
                              )}
                            </div>
                          </div>

                          {/* Common Stats */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                            <div className="bg-white p-2 rounded border border-gray-200">
                              <dt className="text-xs font-medium text-gray-500">Total Values</dt>
                              <dd className="mt-1 text-sm font-semibold text-gray-900">
                                {col.total_values?.toLocaleString()}
                              </dd>
                            </div>
                            <div className="bg-white p-2 rounded border border-gray-200">
                              <dt className="text-xs font-medium text-gray-500">NULLs</dt>
                              <dd className="mt-1 text-sm font-semibold text-gray-900">
                                {col.null_count?.toLocaleString()} ({col.null_percentage}%)
                              </dd>
                            </div>
                            <div className="bg-white p-2 rounded border border-gray-200">
                              <dt className="text-xs font-medium text-gray-500">Distinct</dt>
                              <dd className="mt-1 text-sm font-semibold text-gray-900">
                                {col.distinct_count?.toLocaleString()} ({col.distinct_percentage}%)
                              </dd>
                            </div>
                            <div className="bg-white p-2 rounded border border-gray-200">
                              <dt className="text-xs font-medium text-gray-500">Nullable</dt>
                              <dd className="mt-1 text-sm font-semibold text-gray-900">
                                {col.is_nullable === 'YES' ? '✓ Yes' : '✗ No'}
                              </dd>
                            </div>
                          </div>

                          {/* Numeric Profile */}
                          {profileType === 'numeric' && !col.error && (
                            <div className="space-y-3">
                              <h5 className="text-xs font-semibold text-gray-700 uppercase">Statistical Summary</h5>
                              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                  <dt className="text-xs font-medium text-blue-700">Min</dt>
                                  <dd className="mt-1 text-sm font-bold text-blue-900">{col.min !== null ? col.min : 'N/A'}</dd>
                                </div>
                                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                  <dt className="text-xs font-medium text-blue-700">Q1</dt>
                                  <dd className="mt-1 text-sm font-bold text-blue-900">{col.q1 !== null ? col.q1 : 'N/A'}</dd>
                                </div>
                                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                  <dt className="text-xs font-medium text-blue-700">Median</dt>
                                  <dd className="mt-1 text-sm font-bold text-blue-900">{col.median !== null ? col.median : 'N/A'}</dd>
                                </div>
                                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                  <dt className="text-xs font-medium text-blue-700">Q3</dt>
                                  <dd className="mt-1 text-sm font-bold text-blue-900">{col.q3 !== null ? col.q3 : 'N/A'}</dd>
                                </div>
                                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                  <dt className="text-xs font-medium text-blue-700">Max</dt>
                                  <dd className="mt-1 text-sm font-bold text-blue-900">{col.max !== null ? col.max : 'N/A'}</dd>
                                </div>
                                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                  <dt className="text-xs font-medium text-blue-700">Mean</dt>
                                  <dd className="mt-1 text-sm font-bold text-blue-900">{col.mean !== null ? col.mean : 'N/A'}</dd>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                <div className="bg-white p-2 rounded border border-gray-200">
                                  <dt className="text-xs font-medium text-gray-500">Std Dev</dt>
                                  <dd className="mt-1 text-sm font-semibold text-gray-900">{col.std_dev !== null ? col.std_dev : 'N/A'}</dd>
                                </div>
                                <div className="bg-white p-2 rounded border border-gray-200">
                                  <dt className="text-xs font-medium text-gray-500">Zeros</dt>
                                  <dd className="mt-1 text-sm font-semibold text-gray-900">{col.zero_count}</dd>
                                </div>
                                <div className="bg-white p-2 rounded border border-gray-200">
                                  <dt className="text-xs font-medium text-gray-500">Negatives</dt>
                                  <dd className="mt-1 text-sm font-semibold text-gray-900">{col.negative_count}</dd>
                                </div>
                                <div className={`p-2 rounded border ${col.outliers_count > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                  <dt className={`text-xs font-medium ${col.outliers_count > 0 ? 'text-red-700' : 'text-green-700'}`}>Outliers</dt>
                                  <dd className={`mt-1 text-sm font-semibold ${col.outliers_count > 0 ? 'text-red-900' : 'text-green-900'}`}>
                                    {col.outliers_count} ({col.outliers_percentage}%)
                                  </dd>
                                </div>
                                <div className="bg-white p-2 rounded border border-gray-200">
                                  <dt className="text-xs font-medium text-gray-500">P95 / P99</dt>
                                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                                    {col.p95 !== null ? col.p95 : 'N/A'} / {col.p99 !== null ? col.p99 : 'N/A'}
                                  </dd>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* String Profile */}
                          {profileType === 'string' && !col.error && (
                            <div className="space-y-3">
                              <h5 className="text-xs font-semibold text-gray-700 uppercase">String Analysis</h5>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                <div className="bg-purple-50 p-2 rounded border border-purple-200">
                                  <dt className="text-xs font-medium text-purple-700">Min Length</dt>
                                  <dd className="mt-1 text-sm font-bold text-purple-900">{col.min_length}</dd>
                                </div>
                                <div className="bg-purple-50 p-2 rounded border border-purple-200">
                                  <dt className="text-xs font-medium text-purple-700">Avg Length</dt>
                                  <dd className="mt-1 text-sm font-bold text-purple-900">{col.avg_length}</dd>
                                </div>
                                <div className="bg-purple-50 p-2 rounded border border-purple-200">
                                  <dt className="text-xs font-medium text-purple-700">Max Length</dt>
                                  <dd className="mt-1 text-sm font-bold text-purple-900">{col.max_length}</dd>
                                </div>
                                <div className="bg-white p-2 rounded border border-gray-200">
                                  <dt className="text-xs font-medium text-gray-500">Empty Strings</dt>
                                  <dd className="mt-1 text-sm font-semibold text-gray-900">{col.empty_strings}</dd>
                                </div>
                                <div className="bg-white p-2 rounded border border-gray-200">
                                  <dt className="text-xs font-medium text-gray-500">Whitespace</dt>
                                  <dd className="mt-1 text-sm font-semibold text-gray-900">{col.with_whitespace}</dd>
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded border border-gray-200">
                                <dt className="text-xs font-medium text-gray-500 mb-2">Cardinality</dt>
                                <dd className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900">
                                    {col.unique_count?.toLocaleString()} unique values ({col.cardinality}%)
                                  </span>
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${col.cardinality < 1 ? 'bg-green-500' : col.cardinality < 50 ? 'bg-blue-500' : 'bg-orange-500'}`}
                                      style={{ width: `${Math.min(col.cardinality, 100)}%` }}
                                    ></div>
                                  </div>
                                </dd>
                              </div>
                              {col.top_values && col.top_values.length > 0 && (
                                <div>
                                  <h6 className="text-xs font-semibold text-gray-700 uppercase mb-2">Top Values</h6>
                                  <div className="space-y-1">
                                    {col.top_values.slice(0, 5).map((tv, tvi) => (
                                      <div key={tvi} className="flex items-center gap-2 text-sm">
                                        <span className="font-mono bg-gray-100 px-2 py-1 rounded flex-1 truncate">
                                          {tv.value}
                                        </span>
                                        <span className="text-gray-600">
                                          {tv.count.toLocaleString()} ({tv.percentage}%)
                                        </span>
                                        <div className="w-20 bg-gray-200 rounded-full h-2">
                                          <div
                                            className="bg-purple-500 h-2 rounded-full"
                                            style={{ width: `${tv.percentage}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* DateTime Profile */}
                          {profileType === 'datetime' && !col.error && (
                            <div className="space-y-3">
                              <h5 className="text-xs font-semibold text-gray-700 uppercase">Date/Time Analysis</h5>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div className="bg-green-50 p-2 rounded border border-green-200">
                                  <dt className="text-xs font-medium text-green-700">Earliest</dt>
                                  <dd className="mt-1 text-xs font-semibold text-green-900">
                                    {col.min_date ? new Date(col.min_date).toLocaleDateString() : 'N/A'}
                                  </dd>
                                </div>
                                <div className="bg-green-50 p-2 rounded border border-green-200">
                                  <dt className="text-xs font-medium text-green-700">Latest</dt>
                                  <dd className="mt-1 text-xs font-semibold text-green-900">
                                    {col.max_date ? new Date(col.max_date).toLocaleDateString() : 'N/A'}
                                  </dd>
                                </div>
                                <div className="bg-white p-2 rounded border border-gray-200">
                                  <dt className="text-xs font-medium text-gray-500">Date Range</dt>
                                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                                    {col.date_range_days} days
                                  </dd>
                                </div>
                                <div className={`p-2 rounded border ${col.future_dates > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
                                  <dt className={`text-xs font-medium ${col.future_dates > 0 ? 'text-yellow-700' : 'text-gray-500'}`}>Future Dates</dt>
                                  <dd className={`mt-1 text-sm font-semibold ${col.future_dates > 0 ? 'text-yellow-900' : 'text-gray-900'}`}>
                                    {col.future_dates}
                                  </dd>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Boolean Profile */}
                          {profileType === 'boolean' && !col.error && col.distribution && (
                            <div className="space-y-3">
                              <h5 className="text-xs font-semibold text-gray-700 uppercase">Distribution</h5>
                              <div className="grid grid-cols-2 gap-2">
                                {col.distribution.map((dist, di) => (
                                  <div key={di} className={`p-3 rounded border ${dist.value ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                    <dt className={`text-xs font-medium ${dist.value ? 'text-green-700' : 'text-red-700'}`}>
                                      {dist.value ? 'TRUE' : 'FALSE'}
                                    </dt>
                                    <dd className={`mt-1 text-lg font-bold ${dist.value ? 'text-green-900' : 'text-red-900'}`}>
                                      {dist.count.toLocaleString()} ({dist.percentage}%)
                                    </dd>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Error Display */}
                          {col.error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded">
                              <p className="text-sm text-red-800">⚠️ Error profiling column: {col.error}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 min-h-screen">
      <div className="sm:flex sm:items-center mb-6">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <span className="text-4xl">🎯</span>
            Data Quality Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Run comprehensive data quality checks on your databases and visualize the results
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      <div className="mt-6 bg-white shadow-lg ring-1 ring-gray-900/5 sm:rounded-lg overflow-hidden border border-gray-200">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>⚙️</span> Configure Quality Checks
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span>🔌</span> Select Connection
            </label>
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="mt-1 block w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-3 bg-gray-50 hover:bg-white transition-colors"
            >
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>✓</span> Check Types
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center p-3 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkTypes.null_analysis}
                  onChange={() => handleCheckTypeChange('null_analysis')}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-5 h-5"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 flex items-center gap-2">
                  <span>🔍</span> NULL Value Analysis
                </span>
              </label>
              <label className="flex items-center p-3 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkTypes.schema_validation}
                  onChange={() => handleCheckTypeChange('schema_validation')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 flex items-center gap-2">
                  <span>📋</span> Schema Validation
                </span>
              </label>
              <label className="flex items-center p-3 bg-orange-50 border-2 border-orange-200 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkTypes.gap_detection}
                  onChange={() => handleCheckTypeChange('gap_detection')}
                  className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-5 h-5"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 flex items-center gap-2">
                  <span>📊</span> Data Gap Detection
                </span>
              </label>
              <label className="flex items-center p-3 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkTypes.freshness}
                  onChange={() => handleCheckTypeChange('freshness')}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-5 h-5"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 flex items-center gap-2">
                  <span>⏰</span> Freshness Checks
                </span>
              </label>
              <label className="flex items-center p-3 bg-indigo-50 border-2 border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkTypes.data_profiling}
                  onChange={() => handleCheckTypeChange('data_profiling')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 flex items-center gap-2">
                  <span>📈</span> Data Profiling
                </span>
              </label>
            </div>
          </div>

          {/* Advanced Configuration Section */}
          <div className="mt-6">
            <button
              onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
            >
              <span className="text-lg">{showAdvancedConfig ? '▼' : '▶'}</span>
              <span>⚙️</span> Advanced Configuration
              <span className="text-xs text-gray-500 font-normal">(Optional)</span>
            </button>
            
            {showAdvancedConfig && (
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="mb-3">
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Configuration JSON
                  </label>
                  <p className="text-xs text-gray-600 mb-3">
                    Configure expected schemas, sequence columns, thresholds, and other check parameters.
                    <a 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        setConfigJson(JSON.stringify({
                          expected_schema: {
                            'SalesLT.Customer': {
                              'CustomerID': { 'type': 'int' },
                              'FirstName': { 'type': 'nvarchar' },
                              'LastName': { 'type': 'nvarchar' }
                            }
                          },
                          sequence_columns: {
                            'SalesLT.SalesOrderHeader': ['SalesOrderID']
                          },
                          null_threshold: 0.1,
                          freshness_threshold_hours: 24
                        }, null, 2));
                      }}
                      className="ml-2 text-blue-600 hover:text-blue-800 underline"
                    >
                      Reset to default
                    </a>
                  </p>
                </div>
                <textarea
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  className="w-full h-64 font-mono text-xs p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  placeholder="Enter configuration JSON..."
                  spellCheck="false"
                />
                
                {/* Action Buttons */}
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={handleGenerateConfig}
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-teal-600 rounded-lg hover:from-green-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all shadow-sm"
                  >
                    <span className="mr-2">🔄</span>
                    Generate from Database
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all shadow-sm"
                  >
                    <span className="mr-2">💾</span>
                    Save Configuration
                  </button>
                </div>

                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-xs text-gray-700">
                    <strong>💡 Configuration Options:</strong>
                  </p>
                  <ul className="mt-2 text-xs text-gray-600 space-y-1 list-disc list-inside">
                    <li><code className="bg-gray-100 px-1 rounded">expected_schema</code> - Define expected table structures for schema validation</li>
                    <li><code className="bg-gray-100 px-1 rounded">sequence_columns</code> - Specify columns to check for gaps (e.g., OrderID, ProductID)</li>
                    <li><code className="bg-gray-100 px-1 rounded">null_threshold</code> - NULL percentage threshold (0.1 = 10%)</li>
                    <li><code className="bg-gray-100 px-1 rounded">freshness_threshold_hours</code> - Default hours for freshness checks (24 = 1 day)</li>
                    <li><code className="bg-gray-100 px-1 rounded">freshness_columns</code> - Per-table/column freshness thresholds</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200 mt-6">
            <button
              onClick={handleRunChecks}
              disabled={running}
              className="inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
            >
              {running ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Running Checks...
                </>
              ) : (
                <>
                  <span className="mr-2">▶</span>
                  Run Quality Checks
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {results && (
        <div className="mt-6">
          <div className="border-b border-gray-200 bg-white px-4 rounded-t-lg">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('overview')}
                className={`${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors rounded-t-md`}
              >
                <span>📊</span> Overview
              </button>
              {results.details.null_analysis && (
                <button
                  onClick={() => setActiveTab('null_analysis')}
                  className={`${
                    activeTab === 'null_analysis'
                      ? 'border-purple-500 text-purple-600 bg-purple-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors rounded-t-md`}
                >
                  <span>🔍</span> NULL Analysis
                </button>
              )}
              {results.details.schema_validation && (
                <button
                  onClick={() => setActiveTab('schema_validation')}
                  className={`${
                    activeTab === 'schema_validation'
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors rounded-t-md`}
                >
                  <span>📋</span> Schema
                </button>
              )}
              {results.details.gap_detection && (
                <button
                  onClick={() => setActiveTab('gap_detection')}
                  className={`${
                    activeTab === 'gap_detection'
                      ? 'border-orange-500 text-orange-600 bg-orange-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors rounded-t-md`}
                >
                  <span>📊</span> Gaps & Duplicates
                </button>
              )}
              {results.details.freshness && (
                <button
                  onClick={() => setActiveTab('freshness')}
                  className={`${
                    activeTab === 'freshness'
                      ? 'border-green-500 text-green-600 bg-green-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors rounded-t-md`}
                >
                  <span>⏰</span> Freshness
                </button>
              )}
              {results.details.data_profiling && (
                <button
                  onClick={() => setActiveTab('data_profiling')}
                  className={`${
                    activeTab === 'data_profiling'
                      ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors rounded-t-md`}
                >
                  <span>📈</span> Data Profiling
                </button>
              )}
            </nav>
          </div>

          <div className="mt-6">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'null_analysis' && renderNullAnalysis()}
            {activeTab === 'schema_validation' && renderSchemaValidation()}
            {activeTab === 'gap_detection' && renderGapDetection()}
            {activeTab === 'freshness' && renderFreshness()}
            {activeTab === 'data_profiling' && renderDataProfiling()}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span>📜</span> Recent Checks
            </h2>
            <span className="text-sm text-gray-500">
              Showing {Math.min(5, history.length)} of {history.length}
            </span>
          </div>
          <div className="bg-white shadow-lg overflow-hidden sm:rounded-lg border border-gray-200">
            <ul className="divide-y divide-gray-200">
              {history.slice(0, 5).map((item, idx) => (
                <li key={item.check_id} className="px-6 py-4 hover:bg-blue-50 transition-colors">
                  <button
                    onClick={() => loadHistoricalResults(item.check_id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                          idx === 0 ? 'bg-blue-100 text-blue-600' : 
                          idx === 1 ? 'bg-green-100 text-green-600' : 
                          idx === 2 ? 'bg-purple-100 text-purple-600' : 
                          'bg-gray-100 text-gray-600'
                        }`}>
                          <span className="text-lg font-bold">#{idx + 1}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {new Date(item.timestamp).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(item.timestamp).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="text-xs font-medium text-gray-500 uppercase">Connection</p>
                          <p className="text-sm font-semibold text-blue-600">
                            {item.connection_id}
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default QualityDashboard;
