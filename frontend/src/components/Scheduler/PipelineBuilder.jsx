import React, { useState, useEffect, useCallback } from 'react';
import { expectationsApi, schedulerApi } from '../../api/client';
import StepBuilder from './StepBuilder';

function PipelineBuilder({ onPipelineCreated }) {
  const [pipelineName, setPipelineName] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [scheduleType, setScheduleType] = useState('manual');
  const [connection, setConnection] = useState('');
  const [connections, setConnections] = useState([]);
  const [steps, setSteps] = useState([]);
  const [creating, setCreating] = useState(false);
  const [previewYaml, setPreviewYaml] = useState('');

  const schedulePresets = {
    'manual': { cron: '', label: 'Manual only (no schedule)' },
    'hourly': { cron: '0 */1 * * *', label: 'Every hour' },
    'daily': { cron: '0 0 * * *', label: 'Daily at midnight' },
    'daily_1am': { cron: '0 1 * * *', label: 'Daily at 1:00 AM' },
    'every_6h': { cron: '0 */6 * * *', label: 'Every 6 hours' },
    'weekly': { cron: '0 0 * * 0', label: 'Weekly (Sunday midnight)' },
    'custom': { cron: '', label: 'Custom cron expression' },
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await expectationsApi.getConnections();
      setConnections(response?.connections || []);
      if (response?.connections?.length > 0) {
        setConnection(response.connections[0].id);
      }
    } catch (err) {
      console.error('Error fetching connections:', err);
    }
  };

  const generatePreview = useCallback(() => {
    const sanitizedName = pipelineName.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'my_pipeline';
    const selectedSchedule = scheduleType === 'custom' ? schedule : schedulePresets[scheduleType]?.cron;

    // Generate steps YAML
    let stepsYaml = '';
    if (steps.length === 0) {
      stepsYaml = `  - name: placeholder_step
    command: echo "Add steps using the Step Builder above"`;
    } else {
      stepsYaml = steps.map((step) => {
        let stepYaml = `  - name: ${step.name}\n`;
        
        if (step.type === 'custom') {
          const cmd = step.command || 'echo "TODO: Add command"';
          stepYaml += `    command: |\n      ${cmd}`;
        } else {
          // Quality check step
          const expectation = {
            type: step.type,
            column: step.column || '',
            target: {
              schema: step.schema || 'dbo',
              table: step.table || 'Table'
            },
            params: step.params || {}
          };
          
          stepYaml += `    command: |\n`;
          stepYaml += `      curl -X POST http://backend:8000/api/expectations/validate \\\\\n`;
          stepYaml += `        -H "Content-Type: application/json" \\\\\n`;
          stepYaml += `        -d '{\n`;
          stepYaml += `          "connection_id": "${connection || 'local_adventureworks'}",\n`;
          stepYaml += `          "expectation": ${JSON.stringify(expectation, null, 10).replace(/\n/g, '\n          ')}\n`;
          stepYaml += `        }' \\\\\n`;
          stepYaml += `        -o /tmp/${step.name}_result.json\n`;
          stepYaml += `      \n`;
          stepYaml += `      # Check if test passed\n`;
          stepYaml += `      success=$(jq '.success' /tmp/${step.name}_result.json)\n`;
          stepYaml += `      if [ "$success" != "true" ]; then\n`;
          stepYaml += `        echo "❌ ${step.label} failed"\n`;
          stepYaml += `        exit 1\n`;
          stepYaml += `      else\n`;
          stepYaml += `        echo "✅ ${step.label} passed"\n`;
          stepYaml += `      fi`;
        }
        
        if (step.depends && step.depends.length > 0) {
          stepYaml += `\n    depends:\n`;
          step.depends.forEach(dep => {
            stepYaml += `      - ${dep}\n`;
          });
        }
        
        return stepYaml;
      }).join('\n\n');
    }

    const yaml = `name: ${sanitizedName}
description: ${description || 'Data quality pipeline'}
${selectedSchedule ? `schedule: "${selectedSchedule}"` : '# No schedule - manual trigger only'}
tags:
  - data-quality
  - automated

env:
  - CONNECTION_ID: ${connection || 'local_adventureworks'}

steps:
${stepsYaml}

handlerOn:
  failure:
    command: |
      echo "Pipeline failed at $(date)"
      # Add notification logic here (email, Slack, etc.)
  
  success:
    command: |
      echo "Pipeline completed successfully at $(date)"
      echo "All ${steps.length} step(s) passed"
`;

    setPreviewYaml(yaml);
  }, [pipelineName, description, schedule, scheduleType, connection, steps, schedulePresets]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  const handleCreate = async () => {
    if (!pipelineName.trim()) {
      alert('Please enter a pipeline name');
      return;
    }

    try {
      setCreating(true);
      await schedulerApi.createDag(previewYaml);
      alert(`Pipeline "${pipelineName}" created successfully!`);
      
      // Reset form
      setPipelineName('');
      setDescription('');
      setScheduleType('manual');
      setSchedule('');
      setSteps([]);
      
      if (onPipelineCreated) {
        onPipelineCreated();
      }
    } catch (err) {
      alert('Failed to create pipeline: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(previewYaml);
    alert('YAML copied to clipboard!');
  };

  return (
    <div className="h-full flex">
      {/* Configuration Form */}
      <div className="w-1/2 overflow-y-auto bg-white border-r border-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Create New Pipeline
          </h2>

          <div className="space-y-4">
            {/* Pipeline Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pipeline Name *
              </label>
              <input
                type="text"
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                placeholder="my_quality_pipeline"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use alphanumeric characters, dashes, dots, and underscores only
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this pipeline does..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Schedule Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Schedule
              </label>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(schedulePresets).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </select>
              {scheduleType === 'custom' && (
                <input
                  type="text"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="0 0 * * *"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
                />
              )}
              <p className="text-xs text-gray-500 mt-1">
                Cron format: minute hour day month weekday
              </p>
            </div>

            {/* Connection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Database Connection
              </label>
              <select
                value={connection}
                onChange={(e) => setConnection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Step Builder */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pipeline Steps
              </label>
              <StepBuilder steps={steps} onChange={setSteps} />
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleCreate}
                disabled={creating || !pipelineName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 font-medium"
              >
                {creating ? '⏳ Creating...' : '✓ Create Pipeline'}
              </button>
              <button
                onClick={handleCopyYaml}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium"
                title="Copy YAML to clipboard"
              >
                📋 Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* YAML Preview */}
      <div className="w-1/2 bg-gray-900 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-700 bg-gray-800">
          <h3 className="font-semibold text-white">Pipeline YAML Preview</h3>
          <p className="text-xs text-gray-400 mt-1">
            This file will be created in the <code className="bg-gray-700 px-1 rounded">dags/</code> directory
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="text-xs font-mono text-gray-100 whitespace-pre-wrap">
            {previewYaml}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default PipelineBuilder;
