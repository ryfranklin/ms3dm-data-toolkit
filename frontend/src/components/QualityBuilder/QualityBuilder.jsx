import React, { useState, useEffect } from 'react';
import { configApi } from '../../api/client';
import ExpectationLibrary from './ExpectationLibrary';
import CheckCanvas from './CheckCanvas';
import ConfigPanel from './ConfigPanel';
import ResultsViewer from './ResultsViewer';

function QualityBuilder() {
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState('');
  const [selectedTable, setSelectedTable] = useState({ schema: '', table: '' });
  const [expectations, setExpectations] = useState([]);
  const [selectedExpectation, setSelectedExpectation] = useState(null);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const data = await configApi.getConnections();
      setConnections(data.connections || []);
      if (data.connections && data.connections.length > 0) {
        setSelectedConnection(data.connections[0].id);
      }
    } catch (err) {
      setError('Failed to load connections: ' + err.message);
    }
  };

  const handleAddExpectation = (expectationTemplate) => {
    // Validate that a table is selected
    if (!selectedTable?.schema || !selectedTable?.table) {
      setError('Please select a schema and table before adding checks');
      return;
    }

    const newExpectation = {
      id: `exp_${Date.now()}`,
      type: expectationTemplate.id,
      name: expectationTemplate.name,
      icon: expectationTemplate.icon,
      description: expectationTemplate.description,
      column: '',
      params: {},
      target: {
        schema: selectedTable.schema,
        table: selectedTable.table
      }
    };
    setExpectations([...expectations, newExpectation]);
    setSelectedExpectation(newExpectation);
    setError(null); // Clear any previous errors
  };

  const handleUpdateExpectation = (id, updates) => {
    setExpectations(expectations.map(exp => 
      exp.id === id ? { ...exp, ...updates } : exp
    ));
    if (selectedExpectation?.id === id) {
      setSelectedExpectation({ ...selectedExpectation, ...updates });
    }
  };

  const handleDeleteExpectation = (id) => {
    setExpectations(expectations.filter(exp => exp.id !== id));
    if (selectedExpectation?.id === id) {
      setSelectedExpectation(null);
    }
  };

  const handleRunChecks = async () => {
    if (expectations.length === 0) {
      setError('Please add at least one check');
      return;
    }

    // Validate that all expectations have valid targets
    const invalidChecks = expectations.filter(exp => 
      !exp.target?.schema || !exp.target?.table
    );
    
    if (invalidChecks.length > 0) {
      setError(`${invalidChecks.length} check(s) have missing schema/table. Please delete and re-add them after selecting a table.`);
      return;
    }

    // Validate that a connection is selected
    if (!selectedConnection) {
      setError('Please select a database connection');
      return;
    }

    setRunning(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/expectations/run-adhoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${selectedTable.table || 'Unknown'} Validation`,
          connection_id: selectedConnection,
          expectations: expectations
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to run checks');
      }
      
      const result = await response.json();
      setResults(result);
    } catch (err) {
      setError('Failed to run checks: ' + err.message);
    } finally {
      setRunning(false);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all checks?')) {
      setExpectations([]);
      setSelectedExpectation(null);
      setResults(null);
    }
  };

  const handleUpdateTableForAllChecks = () => {
    if (!selectedTable?.schema || !selectedTable?.table) {
      setError('Please select a schema and table first');
      return;
    }

    if (expectations.length === 0) {
      return;
    }

    if (window.confirm(`Update all ${expectations.length} check(s) to use ${selectedTable.schema}.${selectedTable.table}?`)) {
      const updatedExpectations = expectations.map(exp => ({
        ...exp,
        target: {
          schema: selectedTable.schema,
          table: selectedTable.table
        }
      }));
      setExpectations(updatedExpectations);
      if (selectedExpectation) {
        setSelectedExpectation({
          ...selectedExpectation,
          target: {
            schema: selectedTable.schema,
            table: selectedTable.table
          }
        });
      }
      setError(null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Data Quality Builder
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Create and run data quality checks visually
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
            {expectations.some(exp => !exp.target?.schema || !exp.target?.table) && (
              <button
                onClick={handleUpdateTableForAllChecks}
                className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-sm font-medium shadow-sm"
                title="Some checks have invalid targets. Click to update them."
              >
                ⚠ Update Targets
              </button>
            )}
            <button
              onClick={handleClearAll}
              disabled={expectations.length === 0}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 text-sm font-medium"
            >
              Clear All
            </button>
            <button
              onClick={handleRunChecks}
              disabled={running || expectations.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-sm font-medium shadow-sm"
            >
              {running ? '⏳ Running...' : `▶ Run ${expectations.length} Check${expectations.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Expectation Library */}
        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <ExpectationLibrary onAddExpectation={handleAddExpectation} />
        </div>

        {/* Center: Check Canvas */}
        <div className="flex-1 overflow-y-auto">
          <CheckCanvas
            expectations={expectations}
            selectedExpectation={selectedExpectation}
            selectedTable={selectedTable}
            selectedConnection={selectedConnection}
            onSelectExpectation={setSelectedExpectation}
            onDeleteExpectation={handleDeleteExpectation}
            onUpdateTable={setSelectedTable}
          />
        </div>

        {/* Right: Configuration Panel */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <ConfigPanel
            expectation={selectedExpectation}
            onUpdate={(updates) => {
              if (selectedExpectation) {
                handleUpdateExpectation(selectedExpectation.id, updates);
              }
            }}
          />
        </div>
      </div>

      {/* Bottom: Results */}
      {results && (
        <div className="border-t border-gray-200 bg-white">
          <ResultsViewer 
            results={results}
            onClose={() => setResults(null)}
          />
        </div>
      )}
    </div>
  );
}

export default QualityBuilder;
