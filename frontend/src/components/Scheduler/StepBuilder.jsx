import React, { useState, useEffect } from 'react';
import { expectationsApi } from '../../api/client';

function StepBuilder({ steps, onChange }) {
  const [library, setLibrary] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState('');
  const [showStepLibrary, setShowStepLibrary] = useState(false);

  useEffect(() => {
    fetchLibrary();
    fetchConnections();
  }, []);

  const fetchLibrary = async () => {
    try {
      const response = await expectationsApi.getLibrary();
      setLibrary(response?.categories || []);
    } catch (err) {
      console.error('Error fetching library:', err);
    }
  };

  const fetchConnections = async () => {
    try {
      const response = await expectationsApi.getConnections();
      setConnections(response?.connections || []);
      if (response?.connections?.length > 0) {
        setSelectedConnection(response.connections[0].id);
      }
    } catch (err) {
      console.error('Error fetching connections:', err);
    }
  };

  const addStep = (stepType) => {
    const newStep = {
      id: `step_${Date.now()}`,
      name: `${stepType.name.toLowerCase().replace(/\s+/g, '_')}_${steps.length + 1}`,
      type: stepType.id,
      label: stepType.name,
      icon: stepType.icon,
      description: stepType.description,
      connection: selectedConnection,
      schema: 'SalesLT',
      table: 'Customer',
      column: '',
      params: {},
      depends: steps.length > 0 ? [steps[steps.length - 1].name] : [],
    };
    onChange([...steps, newStep]);
    setShowStepLibrary(false);
  };

  const removeStep = (stepId) => {
    const updatedSteps = steps.filter(s => s.id !== stepId);
    // Update dependencies
    const removedStep = steps.find(s => s.id === stepId);
    if (removedStep) {
      updatedSteps.forEach(step => {
        if (step.depends?.includes(removedStep.name)) {
          step.depends = step.depends.filter(d => d !== removedStep.name);
        }
      });
    }
    onChange(updatedSteps);
  };

  const updateStep = (stepId, updates) => {
    onChange(steps.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const moveStep = (index, direction) => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    onChange(newSteps);
  };

  const addCustomStep = () => {
    const newStep = {
      id: `step_${Date.now()}`,
      name: `custom_step_${steps.length + 1}`,
      type: 'custom',
      label: 'Custom Step',
      icon: '⚙️',
      description: 'Custom shell command',
      command: 'echo "Hello World"',
      depends: steps.length > 0 ? [steps[steps.length - 1].name] : [],
    };
    onChange([...steps, newStep]);
  };

  return (
    <div className="space-y-4">
      {/* Step List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Pipeline Steps ({steps.length})
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowStepLibrary(!showStepLibrary)}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              ➕ Quality Check
            </button>
            <button
              onClick={addCustomStep}
              className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 font-medium"
            >
              ➕ Custom Step
            </button>
          </div>
        </div>

        {/* Step Library Dropdown */}
        {showStepLibrary && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-3">
              Select Quality Check Type
            </h4>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {library.map((category) => (
                <div key={category.name}>
                  <div className="text-xs font-semibold text-gray-700 mb-1 uppercase">
                    {category.name}
                  </div>
                  {category.expectations.map((exp) => (
                    <button
                      key={exp.id}
                      onClick={() => addStep(exp)}
                      className="w-full text-left p-2 text-xs bg-white border border-gray-200 rounded hover:bg-blue-100 hover:border-blue-300 mb-1"
                    >
                      <div className="flex items-center">
                        <span className="mr-2">{exp.icon}</span>
                        <span className="font-medium">{exp.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowStepLibrary(false)}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800"
            >
              ✕ Close
            </button>
          </div>
        )}

        {/* Steps List */}
        {steps.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm text-gray-600 mb-2">No steps added yet</p>
            <p className="text-xs text-gray-500">
              Add quality checks or custom steps to build your pipeline
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start flex-1">
                    <div className="text-2xl mr-3">{step.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                          #{index + 1}
                        </span>
                        <input
                          type="text"
                          value={step.name}
                          onChange={(e) => updateStep(step.id, { name: e.target.value })}
                          className="text-sm font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1"
                          placeholder="Step name"
                        />
                      </div>
                      
                      <p className="text-xs text-gray-600 mb-2">{step.description}</p>
                      
                      {step.type !== 'custom' && (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <input
                            type="text"
                            value={step.schema || ''}
                            onChange={(e) => updateStep(step.id, { schema: e.target.value })}
                            placeholder="Schema"
                            className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={step.table || ''}
                            onChange={(e) => updateStep(step.id, { table: e.target.value })}
                            placeholder="Table"
                            className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={step.column || ''}
                            onChange={(e) => updateStep(step.id, { column: e.target.value })}
                            placeholder="Column (if needed)"
                            className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      )}

                      {step.type === 'custom' && (
                        <textarea
                          value={step.command || ''}
                          onChange={(e) => updateStep(step.id, { command: e.target.value })}
                          placeholder="Shell command..."
                          rows={2}
                          className="w-full px-2 py-1 text-xs font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 mt-2"
                        />
                      )}

                      {step.depends && step.depends.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          Depends on: <span className="font-mono bg-yellow-50 px-1.5 py-0.5 rounded">{step.depends.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-1 ml-2">
                    <button
                      onClick={() => moveStep(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveStep(index, 'down')}
                      disabled={index === steps.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move down"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => removeStep(step.id)}
                      className="p-1 text-red-400 hover:text-red-600"
                      title="Remove step"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StepBuilder;
