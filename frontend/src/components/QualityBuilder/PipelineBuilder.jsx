import React, { useState, useEffect } from 'react';
import axios from 'axios';

function PipelineBuilder() {
  const [connections, setConnections] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [tables, setTables] = useState({});
  const [columns, setColumns] = useState({});
  const [availableChecks, setAvailableChecks] = useState([]);
  
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDescription, setPipelineDescription] = useState('');
  const [steps, setSteps] = useState([createEmptyStep()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [existingPipelines, setExistingPipelines] = useState([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [showPipelines, setShowPipelines] = useState(true); // Default to expanded
  const [deletingPipeline, setDeletingPipeline] = useState(null);

  useEffect(() => {
    loadConnections();
    loadAvailableChecks();
    loadExistingPipelines();
  }, []);

  function createEmptyStep() {
    return {
      id: Date.now() + Math.random(),
      name: '',
      connectionId: '',
      schema: '',
      table: '',
      selectedChecks: [],
      checkConfigs: {}, // Store configuration for each check
      onFailure: 'continue' // 'continue' or 'stop'
    };
  }

  const loadConnections = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/config/');
      setConnections(response.data.connections || []);
    } catch (err) {
      console.error('Failed to load connections:', err);
    }
  };

  const loadAvailableChecks = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/quality/available-checks');
      setAvailableChecks(response.data || []);
    } catch (err) {
      console.error('Failed to load checks:', err);
      // Fallback to default checks
      setAvailableChecks([
        { id: 'not_null', name: 'Not Null', description: 'Column values must not be null' },
        { id: 'unique', name: 'Unique Values', description: 'Column values must be unique' },
        { id: 'value_range', name: 'Value Range', description: 'Numeric values within range' },
        { id: 'value_set', name: 'Value Set', description: 'Values must be in allowed set' },
        { id: 'row_count', name: 'Row Count', description: 'Table has expected row count' }
      ]);
    }
  };

  const loadSchemas = async (connectionId, stepId) => {
    try {
      const response = await axios.post('http://localhost:8000/api/catalog/discover', {
        connection_id: connectionId
      });
      setSchemas(response.data.schemas || []);
      
      // Update step with first schema
      if (response.data.schemas && response.data.schemas.length > 0) {
        updateStep(stepId, { schema: response.data.schemas[0].name });
        loadTables(connectionId, response.data.schemas[0].name, stepId);
      }
    } catch (err) {
      console.error('Failed to load schemas:', err);
    }
  };

  const loadTables = async (connectionId, schema, stepId) => {
    try {
      const response = await axios.post('http://localhost:8000/api/catalog/discover', {
        connection_id: connectionId
      });
      const schemaData = response.data.schemas.find(s => s.name === schema);
      if (schemaData) {
        setTables(prev => ({ ...prev, [stepId]: schemaData.tables || [] }));
        
        // Update step with first table
        if (schemaData.tables && schemaData.tables.length > 0) {
          updateStep(stepId, { table: schemaData.tables[0].name });
          loadColumns(connectionId, schema, schemaData.tables[0].name, stepId);
        }
      }
    } catch (err) {
      console.error('Failed to load tables:', err);
    }
  };

  const loadColumns = async (connectionId, schema, table, stepId) => {
    try {
      const response = await axios.get(
        `http://localhost:8000/api/catalog/table/${schema}/${table}`,
        { params: { connection_id: connectionId } }
      );
      
      if (response.data.columns) {
        setColumns(prev => ({ ...prev, [stepId]: response.data.columns }));
      }
    } catch (err) {
      console.error('Failed to load columns:', err);
    }
  };

  const updateStep = (stepId, updates) => {
    setSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      )
    );
  };

  const handleConnectionChange = (stepId, connectionId) => {
    updateStep(stepId, { connectionId, schema: '', table: '', selectedChecks: [] });
    if (connectionId) {
      loadSchemas(connectionId, stepId);
    }
  };

  const handleSchemaChange = (stepId, schema) => {
    const step = steps.find(s => s.id === stepId);
    updateStep(stepId, { schema, table: '', selectedChecks: [] });
    if (step && step.connectionId && schema) {
      loadTables(step.connectionId, schema, stepId);
    }
  };

  const handleTableChange = (stepId, table) => {
    const step = steps.find(s => s.id === stepId);
    updateStep(stepId, { table, selectedChecks: [], checkConfigs: {} });
    if (step && step.connectionId && step.schema && table) {
      loadColumns(step.connectionId, step.schema, table, stepId);
    }
  };

  const toggleCheck = (stepId, checkId) => {
    setSteps(prevSteps =>
      prevSteps.map(step => {
        if (step.id === stepId) {
          const isSelected = step.selectedChecks.includes(checkId);
          const newSelectedChecks = isSelected
            ? step.selectedChecks.filter(id => id !== checkId)
            : [...step.selectedChecks, checkId];
          
          // Initialize config for new check
          const newCheckConfigs = { ...step.checkConfigs };
          if (!isSelected) {
            newCheckConfigs[checkId] = getDefaultCheckConfig(checkId);
          } else {
            delete newCheckConfigs[checkId];
          }
          
          return {
            ...step,
            selectedChecks: newSelectedChecks,
            checkConfigs: newCheckConfigs
          };
        }
        return step;
      })
    );
  };

  const getDefaultCheckConfig = (checkId) => {
    const defaults = {
      'not_null': { columns: [] },
      'unique': { columns: [] },
      'value_range': { column: '', min: '', max: '' },
      'value_set': { column: '', allowed_values: '' },
      'row_count': { min: '', max: '' },
      'freshness': { column: '', threshold_hours: '24' },
      'referential_integrity': { column: '', reference_table: '', reference_column: '' },
      'pattern': { column: '', pattern: '' }
    };
    return defaults[checkId] || {};
  };

  const updateCheckConfig = (stepId, checkId, configUpdates) => {
    setSteps(prevSteps =>
      prevSteps.map(step => {
        if (step.id === stepId) {
          return {
            ...step,
            checkConfigs: {
              ...step.checkConfigs,
              [checkId]: {
                ...step.checkConfigs[checkId],
                ...configUpdates
              }
            }
          };
        }
        return step;
      })
    );
  };

  const addStep = () => {
    setSteps([...steps, createEmptyStep()]);
  };

  const removeStep = (stepId) => {
    if (steps.length > 1) {
      setSteps(steps.filter(step => step.id !== stepId));
      setTables(prev => {
        const newTables = { ...prev };
        delete newTables[stepId];
        return newTables;
      });
    }
  };

  const moveStepUp = (index) => {
    if (index > 0) {
      const newSteps = [...steps];
      [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
      setSteps(newSteps);
    }
  };

  const moveStepDown = (index) => {
    if (index < steps.length - 1) {
      const newSteps = [...steps];
      [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
      setSteps(newSteps);
    }
  };

  const validatePipeline = () => {
    if (!pipelineName.trim()) {
      setError('Pipeline name is required');
      return false;
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.name.trim()) {
        setError(`Step ${i + 1} name is required`);
        return false;
      }
      if (!step.connectionId) {
        setError(`Step ${i + 1}: Connection is required`);
        return false;
      }
      if (!step.schema) {
        setError(`Step ${i + 1}: Schema is required`);
        return false;
      }
      if (!step.table) {
        setError(`Step ${i + 1}: Table is required`);
        return false;
      }
      if (step.selectedChecks.length === 0) {
        setError(`Step ${i + 1}: At least one check is required`);
        return false;
      }

      // Validate check configurations
      for (const checkId of step.selectedChecks) {
        const config = step.checkConfigs[checkId] || {};
        const checkName = availableChecks.find(c => c.id === checkId)?.name || checkId;

        if (['not_null', 'unique'].includes(checkId)) {
          if (!config.columns || config.columns.length === 0) {
            setError(`Step ${i + 1} - ${checkName}: At least one column is required`);
            return false;
          }
        }

        if (['value_range', 'value_set', 'freshness', 'pattern'].includes(checkId)) {
          if (!config.column) {
            setError(`Step ${i + 1} - ${checkName}: Column is required`);
            return false;
          }
        }

        if (checkId === 'value_set' && !config.allowed_values) {
          setError(`Step ${i + 1} - ${checkName}: Allowed values are required`);
          return false;
        }

        if (checkId === 'freshness' && !config.threshold_hours) {
          setError(`Step ${i + 1} - ${checkName}: Threshold hours is required`);
          return false;
        }

        if (checkId === 'referential_integrity') {
          if (!config.column || !config.reference_table || !config.reference_column) {
            setError(`Step ${i + 1} - ${checkName}: All fields are required`);
            return false;
          }
        }

        if (checkId === 'pattern' && !config.pattern) {
          setError(`Step ${i + 1} - ${checkName}: Regex pattern is required`);
          return false;
        }
      }
    }

    return true;
  };

  const savePipeline = async () => {
    console.log('Save button clicked');
    setError(null);
    setSuccess(null);

    console.log('Validating pipeline...');
    if (!validatePipeline()) {
      console.log('Validation failed, check error message');
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to see error
      return;
    }

    console.log('Validation passed, saving...');
    setSaving(true);

    try {
      const pipelineData = {
        name: pipelineName.trim(),
        description: pipelineDescription.trim(),
        steps: steps.map((step, index) => ({
          order: index + 1,
          name: step.name.trim(),
          connection_id: step.connectionId,
          schema: step.schema,
          table: step.table,
          checks: step.selectedChecks,
          check_configs: step.checkConfigs,
          on_failure: step.onFailure
        }))
      };

      console.log('Sending pipeline data:', pipelineData);

      const response = await axios.post(
        'http://localhost:8000/api/quality/pipeline',
        pipelineData
      );

      console.log('Pipeline created successfully:', response.data);
      setSuccess(`Pipeline "${pipelineName}" created successfully! DAG file: ${response.data.dag_file}`);
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to see success
      
      // Reset form after short delay
      setTimeout(() => {
        setPipelineName('');
        setPipelineDescription('');
        setSteps([createEmptyStep()]);
        setSuccess(null);
      }, 3000);

    } catch (err) {
      console.error('Failed to save pipeline:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to save pipeline';
      setError(errorMsg);
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to see error
    } finally {
      setSaving(false);
    }
  };

  const loadExistingPipelines = async () => {
    try {
      setLoadingPipelines(true);
      const response = await axios.get('http://localhost:8000/api/quality/pipelines');
      setExistingPipelines(response.data.pipelines || []);
    } catch (err) {
      console.error('Failed to load pipelines:', err);
    } finally {
      setLoadingPipelines(false);
    }
  };

  const deletePipeline = async (filename, pipelineName) => {
    if (!window.confirm(`Are you sure you want to delete "${pipelineName}"?\n\nThis will permanently remove the pipeline file and cannot be undone.`)) {
      return;
    }

    try {
      setDeletingPipeline(filename);
      await axios.delete(`http://localhost:8000/api/quality/pipeline/${filename}`);
      
      setSuccess(`Pipeline "${pipelineName}" deleted successfully!`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Reload pipeline list
      loadExistingPipelines();
      
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Failed to delete pipeline:', err);
      setError(err.response?.data?.error || 'Failed to delete pipeline');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setDeletingPipeline(null);
    }
  };

  const openDaguUI = () => {
    window.open('http://localhost:8080', '_blank');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Data Quality Pipeline Builder
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Create multi-step quality check workflows for your data pipelines
            </p>
          </div>
          <button
            onClick={openDaguUI}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            📊 View Pipelines in Dagu
          </button>
        </div>
      </div>

      {/* Error/Success Messages - Sticky at top */}
      {(error || success) && (
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="max-w-5xl mx-auto">
            {error && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 shadow-lg">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">❌</span>
                  <div>
                    <p className="font-semibold text-red-900">Validation Error</p>
                    <p className="text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}
            {success && (
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 shadow-lg">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">✅</span>
                  <div>
                    <p className="font-semibold text-green-900">Success!</p>
                    <p className="text-green-800">{success}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Existing Pipelines Section */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-sm border-2 border-purple-200">
            <button
              onClick={() => setShowPipelines(!showPipelines)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🗂️</span>
                <span className="text-lg font-bold text-gray-900">
                  Existing Quality Pipelines ({existingPipelines.length})
                </span>
                {loadingPipelines && (
                  <span className="inline-block animate-spin text-lg">⏳</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    loadExistingPipelines();
                  }}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                >
                  🔄 Refresh
                </button>
                <span className="text-gray-600 font-bold text-lg">
                  {showPipelines ? '▼' : '▶'}
                </span>
              </div>
            </button>

            {showPipelines && (
              <div className="border-t-2 border-purple-200 bg-white">
                {existingPipelines.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-gray-600 text-lg">📭 No pipelines found</p>
                    <p className="text-gray-500 text-sm mt-2">Create your first quality pipeline below!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {existingPipelines.map(pipeline => (
                      <div
                        key={pipeline.filename}
                        className="px-6 py-4 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-lg">📋</span>
                              <h3 className="text-lg font-bold text-gray-900">
                                {pipeline.name}
                              </h3>
                              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold">
                                {pipeline.steps_count} STEP{pipeline.steps_count !== 1 ? 'S' : ''}
                              </span>
                            </div>
                            {pipeline.description && (
                              <p className="text-sm text-gray-700 mb-2 ml-8">
                                {pipeline.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 ml-8">
                              📄 {pipeline.filename}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                            <button
                              onClick={() => window.open(pipeline.dagu_url, '_blank')}
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                            >
                              📊 Open in Dagu
                            </button>
                            <button
                              onClick={() => deletePipeline(pipeline.filename, pipeline.name)}
                              disabled={deletingPipeline === pipeline.filename}
                              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm"
                            >
                              {deletingPipeline === pipeline.filename ? '⏳ Deleting...' : '🗑️ Delete'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pipeline Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pipeline Name *
                </label>
                <input
                  type="text"
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  placeholder="e.g., Sales ETL Quality Check"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={pipelineDescription}
                  onChange={(e) => setPipelineDescription(e.target.value)}
                  placeholder="Describe the purpose of this pipeline..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Quality Check Steps ({steps.length})
              </h2>
              <button
                onClick={addStep}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                ➕ Add Step
              </button>
            </div>

            {steps.map((step, index) => (
              <div
                key={step.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                {/* Step Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveStepUp(index)}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveStepDown(index)}
                        disabled={index === steps.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => updateStep(step.id, { name: e.target.value })}
                        placeholder="Step name (e.g., Check Loading Table)"
                        className="text-lg font-semibold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-2 py-1 w-full"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removeStep(step.id)}
                    disabled={steps.length === 1}
                    className="text-red-600 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
                    title="Remove step"
                  >
                    ✕ Remove
                  </button>
                </div>

                {/* Step Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Connection *
                    </label>
                    <select
                      value={step.connectionId}
                      onChange={(e) => handleConnectionChange(step.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select connection...</option>
                      {connections.map(conn => (
                        <option key={conn.id} value={conn.id}>{conn.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Schema *
                    </label>
                    <select
                      value={step.schema}
                      onChange={(e) => handleSchemaChange(step.id, e.target.value)}
                      disabled={!step.connectionId}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">Select schema...</option>
                      {schemas.map(schema => (
                        <option key={schema.name} value={schema.name}>{schema.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Table *
                    </label>
                    <select
                      value={step.table}
                      onChange={(e) => handleTableChange(step.id, e.target.value)}
                      disabled={!step.schema}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">Select table...</option>
                      {(tables[step.id] || []).map(table => (
                        <option key={table.name} value={table.name}>{table.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quality Checks */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quality Checks * (select at least one)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {availableChecks.map(check => (
                      <label
                        key={check.id}
                        className={`
                          flex items-start p-3 border rounded-md cursor-pointer transition-colors
                          ${step.selectedChecks.includes(check.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                          }
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={step.selectedChecks.includes(check.id)}
                          onChange={() => toggleCheck(step.id, check.id)}
                          className="mt-0.5 mr-3"
                        />
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{check.name}</div>
                          <div className="text-xs text-gray-600">{check.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Check Configurations */}
                {step.selectedChecks.length > 0 && (
                  <div className="mt-4 space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">Configure Selected Checks</h4>
                    
                    {step.selectedChecks.map(checkId => {
                      const check = availableChecks.find(c => c.id === checkId);
                      const config = step.checkConfigs[checkId] || {};
                      const stepColumns = columns[step.id] || [];

                      return (
                        <div key={checkId} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="font-medium text-gray-900 mb-3 flex items-center">
                            <span className="text-blue-600 mr-2">⚙️</span>
                            {check?.name}
                          </div>

                          {/* Not Null Configuration */}
                          {checkId === 'not_null' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Columns to Check *
                              </label>
                              <select
                                multiple
                                value={config.columns || []}
                                onChange={(e) => {
                                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                                  updateCheckConfig(step.id, checkId, { columns: selected });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                size={Math.min(5, stepColumns.length)}
                              >
                                {stepColumns.map(col => (
                                  <option key={col.name} value={col.name}>{col.name} ({col.data_type})</option>
                                ))}
                              </select>
                              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple columns</p>
                            </div>
                          )}

                          {/* Unique Configuration */}
                          {checkId === 'unique' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Columns that Must Be Unique *
                              </label>
                              <select
                                multiple
                                value={config.columns || []}
                                onChange={(e) => {
                                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                                  updateCheckConfig(step.id, checkId, { columns: selected });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                size={Math.min(5, stepColumns.length)}
                              >
                                {stepColumns.map(col => (
                                  <option key={col.name} value={col.name}>{col.name} ({col.data_type})</option>
                                ))}
                              </select>
                              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple columns</p>
                            </div>
                          )}

                          {/* Value Range Configuration */}
                          {checkId === 'value_range' && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Column *
                                </label>
                                <select
                                  value={config.column || ''}
                                  onChange={(e) => updateCheckConfig(step.id, checkId, { column: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select column...</option>
                                  {stepColumns.filter(col => 
                                    ['int', 'bigint', 'smallint', 'decimal', 'numeric', 'float', 'real', 'money'].some(type => 
                                      col.data_type.toLowerCase().includes(type)
                                    )
                                  ).map(col => (
                                    <option key={col.name} value={col.name}>{col.name} ({col.data_type})</option>
                                  ))}
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Value</label>
                                  <input
                                    type="number"
                                    value={config.min || ''}
                                    onChange={(e) => updateCheckConfig(step.id, checkId, { min: e.target.value })}
                                    placeholder="Optional"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Value</label>
                                  <input
                                    type="number"
                                    value={config.max || ''}
                                    onChange={(e) => updateCheckConfig(step.id, checkId, { max: e.target.value })}
                                    placeholder="Optional"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Value Set Configuration */}
                          {checkId === 'value_set' && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Column *
                                </label>
                                <select
                                  value={config.column || ''}
                                  onChange={(e) => updateCheckConfig(step.id, checkId, { column: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select column...</option>
                                  {stepColumns.map(col => (
                                    <option key={col.name} value={col.name}>{col.name} ({col.data_type})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Allowed Values * (comma-separated)
                                </label>
                                <input
                                  type="text"
                                  value={config.allowed_values || ''}
                                  onChange={(e) => updateCheckConfig(step.id, checkId, { allowed_values: e.target.value })}
                                  placeholder="e.g., Active, Inactive, Pending"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          )}

                          {/* Row Count Configuration */}
                          {checkId === 'row_count' && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Min Row Count</label>
                                <input
                                  type="number"
                                  value={config.min || ''}
                                  onChange={(e) => updateCheckConfig(step.id, checkId, { min: e.target.value })}
                                  placeholder="Optional"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Max Row Count</label>
                                <input
                                  type="number"
                                  value={config.max || ''}
                                  onChange={(e) => updateCheckConfig(step.id, checkId, { max: e.target.value })}
                                  placeholder="Optional"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          )}

                          {/* Freshness Configuration */}
                          {checkId === 'freshness' && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Datetime Column *
                                </label>
                                <select
                                  value={config.column || ''}
                                  onChange={(e) => updateCheckConfig(step.id, checkId, { column: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select column...</option>
                                  {stepColumns.filter(col => 
                                    ['datetime', 'date', 'timestamp', 'time'].some(type => 
                                      col.data_type.toLowerCase().includes(type)
                                    )
                                  ).map(col => (
                                    <option key={col.name} value={col.name}>{col.name} ({col.data_type})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Threshold (hours) *
                                </label>
                                <input
                                  type="number"
                                  value={config.threshold_hours || '24'}
                                  onChange={(e) => updateCheckConfig(step.id, checkId, { threshold_hours: e.target.value })}
                                  placeholder="24"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">Data must be updated within this many hours</p>
                              </div>
                            </div>
                          )}

                          {/* Referential Integrity Configuration */}
                          {checkId === 'referential_integrity' && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Foreign Key Column *
                                </label>
                                <select
                                  value={config.column || ''}
                                  onChange={(e) => updateCheckConfig(step.id, checkId, { column: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select column...</option>
                                  {stepColumns.map(col => (
                                    <option key={col.name} value={col.name}>{col.name} ({col.data_type})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Reference Table * (schema.table)
                                </label>
                                <input
                                  type="text"
                                  value={config.reference_table || ''}
                                  onChange={(e) => updateCheckConfig(step.id, checkId, { reference_table: e.target.value })}
                                  placeholder="e.g., dbo.Customers"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Reference Column *
                                </label>
                                <input
                                  type="text"
                                  value={config.reference_column || ''}
                                  onChange={(e) => updateCheckConfig(step.id, checkId, { reference_column: e.target.value })}
                                  placeholder="e.g., CustomerID"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          )}

                          {/* Pattern Configuration */}
                          {checkId === 'pattern' && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Column *
                                </label>
                                <select
                                  value={config.column || ''}
                                  onChange={(e) => updateCheckConfig(step.id, checkId, { column: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select column...</option>
                                  {stepColumns.filter(col => 
                                    ['varchar', 'char', 'text', 'nvarchar', 'nchar'].some(type => 
                                      col.data_type.toLowerCase().includes(type)
                                    )
                                  ).map(col => (
                                    <option key={col.name} value={col.name}>{col.name} ({col.data_type})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Regex Pattern *
                                </label>
                                <input
                                  type="text"
                                  value={config.pattern || ''}
                                  onChange={(e) => updateCheckConfig(step.id, checkId, { pattern: e.target.value })}
                                  placeholder="e.g., ^[A-Z]{2}\d{4}$ for SKU format"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Examples: Email: ^\S+@\S+\.\S+$ | Phone: ^\d{3}-\d{3}-\d{4}$
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Failure Behavior */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    On Failure
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={step.onFailure === 'continue'}
                        onChange={() => updateStep(step.id, { onFailure: 'continue' })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Continue to next step</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={step.onFailure === 'stop'}
                        onChange={() => updateStep(step.id, { onFailure: 'stop' })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Stop pipeline</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-sm text-gray-600">
              {steps.length} step{steps.length !== 1 ? 's' : ''} configured
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPipelineName('');
                  setPipelineDescription('');
                  setSteps([createEmptyStep()]);
                  setError(null);
                  setSuccess(null);
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
              >
                Reset
              </button>
              <button
                onClick={savePipeline}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {saving ? '💾 Saving...' : '💾 Save Pipeline'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PipelineBuilder;
