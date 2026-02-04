import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { configApi, flowsApi } from '../../api/client';
import DatabaseBrowser from './DatabaseBrowser';
import NodePalette from './NodePalette';
import PropertiesPanel from './PropertiesPanel';
import FlowMetadataModal from './FlowMetadataModal';
import RelationshipsModal from './RelationshipsModal';
import ImportSQLModal from './ImportSQLModal';
import GroupNode from './GroupNode';

function FlowVisualizer() {
  // Define custom node types
  const nodeTypes = useMemo(() => ({ group: GroupNode }), []);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState('');
  const [flows, setFlows] = useState([]);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [showRelationshipsModal, setShowRelationshipsModal] = useState(false);
  const [showImportSQLModal, setShowImportSQLModal] = useState(false);
  const [discoveredRelationships, setDiscoveredRelationships] = useState([]);
  const [flowMetadata, setFlowMetadata] = useState({
    name: '',
    description: '',
    owner: '',
    schedule: '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConnections();
    loadFlows();
  }, []);

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

  const loadFlows = async () => {
    try {
      const data = await flowsApi.getFlows();
      setFlows(data.flows || []);
    } catch (err) {
      console.error('Failed to load flows:', err);
    }
  };

  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const reactFlowBounds = event.target.getBoundingClientRect();
      const tableData = JSON.parse(
        event.dataTransfer.getData('application/reactflow')
      );

      if (tableData) {
        const position = {
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        };

        const newNode = {
          id: `source_${tableData.schema}_${tableData.name}_${Date.now()}`,
          type: 'default',
          position,
          data: {
            label: tableData.full_name,
            type: 'source',
            table: tableData.full_name,
            schema: tableData.schema,
            tableName: tableData.name,
          },
          style: {
            background: tableData.type === 'view' ? '#fef3c7' : '#dbeafe',
            border: tableData.type === 'view' ? '2px solid #f59e0b' : '2px solid #3b82f6',
            borderRadius: '8px',
            padding: '10px',
          },
        };

        setNodes((nds) => nds.concat(newNode));
      }
    },
    [setNodes]
  );

  const handleNewFlow = () => {
    setNodes([]);
    setEdges([]);
    setSelectedFlow(null);
    setFlowMetadata({
      name: '',
      description: '',
      owner: '',
      schedule: '',
    });
    setShowMetadataModal(true);
  };

  const handleLoadFlow = async (flowId) => {
    try {
      const data = await flowsApi.getFlow(flowId);
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setFlowMetadata(data.metadata || {});
      setSelectedFlow(flowId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveFlow = async () => {
    if (!flowMetadata.name) {
      setError('Please provide a flow name');
      return;
    }

    try {
      setSaving(true);
      const canvasData = {
        nodes,
        edges,
        metadata: flowMetadata,
      };

      if (selectedFlow) {
        await flowsApi.updateFlow(selectedFlow, canvasData);
        setError(null);
        alert('Flow updated successfully!');
      } else {
        const result = await flowsApi.createFlow(canvasData);
        setSelectedFlow(result.flow_id);
        setError(null);
        alert('Flow created successfully!');
      }

      loadFlows();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTable = (table) => {
    const newNode = {
      id: `source_${Date.now()}`,
      type: 'default',
      position: { x: 100, y: nodes.length * 100 + 50 },
      data: {
        label: table.full_name,
        type: 'source',
        table: table.full_name,
        schema: table.schema,
        tableName: table.name,
      },
      style: {
        background: '#dbeafe',
        border: '2px solid #3b82f6',
        borderRadius: '8px',
        padding: '10px',
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleAddTransformation = (type) => {
    const newNode = {
      id: `transform_${Date.now()}`,
      type: 'default',
      position: { x: 300, y: nodes.length * 100 + 50 },
      data: {
        label: type,
        type: 'transformation',
        transformationType: type,
        description: '',
        sqlSnippet: '',
      },
      style: {
        background: '#fef3c7',
        border: '2px solid #f59e0b',
        borderRadius: '8px',
        padding: '10px',
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleAddSource = (label, sourceType) => {
    const newNode = {
      id: `source_${sourceType}_${Date.now()}`,
      type: 'default',
      position: { x: 100, y: nodes.length * 100 + 50 },
      data: {
        label: label,
        type: 'source',
        sourceType: sourceType,
        connection: '',
        path: '',
        configuration: {},
      },
      style: {
        background: '#dbeafe',
        border: '2px solid #3b82f6',
        borderRadius: '8px',
        padding: '10px',
        minWidth: '150px',
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleAddDestination = (label = 'Destination', destinationType = 'sql_table_dest') => {
    const newNode = {
      id: `destination_${destinationType}_${Date.now()}`,
      type: 'default',
      position: { x: 500, y: nodes.length * 100 + 50 },
      data: {
        label: label,
        type: 'destination',
        destinationType: destinationType,
        table: '',
        schema: '',
        tableName: '',
        connection: '',
        path: '',
        configuration: {},
      },
      style: {
        background: '#dcfce7',
        border: '2px solid #22c55e',
        borderRadius: '8px',
        padding: '10px',
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleAddGroup = () => {
    const groupNumber = nodes.filter(n => n.data.type === 'group').length + 1;
    const newNode = {
      id: `group_${Date.now()}`,
      type: 'group',
      position: { x: 100, y: 100 + nodes.length * 50 },
      data: {
        label: `Group ${groupNumber}`,
        type: 'group',
        description: 'Drag corners to resize',
      },
      style: {
        background: 'transparent', // Fully transparent background
        border: '2px dashed #9ca3af',
        borderRadius: '12px',
        padding: '0',
        width: 300,
        height: 200,
        textAlign: 'center',
        zIndex: -1, // Send to back so it doesn't hide other nodes
      },
      draggable: true,
      selectable: true,
      zIndex: -1, // Also set at node level
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleNodeUpdate = (nodeId, updates) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...updates },
            ...(updates.label && { data: { ...node.data, label: updates.label } }),
          };
        }
        return node;
      })
    );
  };

  const handleNodeDelete = (nodeId) => {
    // Remove the node
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    // Remove any edges connected to this node
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    // Clear selection
    setSelectedNode(null);
  };

  const handleDiscoverRelationships = async () => {
    if (!selectedConnection) {
      setError('Please select a connection first');
      return;
    }

    try {
      const data = await flowsApi.discoverRelationships(selectedConnection);
      setDiscoveredRelationships(data.foreign_keys || []);
      setShowRelationshipsModal(true);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImportSQL = async (sqlCode) => {
    try {
      setError(null);
      const result = await flowsApi.parseSql(sqlCode);
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Calculate offset for new nodes to avoid overlap with existing nodes
      const maxY = nodes.length > 0 
        ? Math.max(...nodes.map(n => n.position.y)) + 150 
        : 100;

      // Add parsed nodes to canvas with offset
      const newNodes = result.nodes.map(node => ({
        ...node,
        id: `imported_${node.id}_${Date.now()}`,
        position: {
          x: node.position.x + 50,
          y: node.position.y + maxY
        }
      }));

      // Update edge references to match new node IDs
      const nodeIdMap = {};
      result.nodes.forEach((oldNode, index) => {
        nodeIdMap[oldNode.id] = newNodes[index].id;
      });

      const newEdges = result.edges.map(edge => ({
        ...edge,
        id: `imported_${edge.id}_${Date.now()}`,
        source: nodeIdMap[edge.source] || edge.source,
        target: nodeIdMap[edge.target] || edge.target
      }));

      // Add to existing canvas
      setNodes((nds) => [...nds, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);

    } catch (err) {
      throw new Error(`Failed to import SQL: ${err.message}`);
    }
  };

  const handleAddRelationshipToCanvas = (relationship) => {
    // Add source table node
    const sourceNode = {
      id: `source_${relationship.SOURCE_SCHEMA}_${relationship.SOURCE_TABLE}_${Date.now()}`,
      type: 'default',
      position: { x: 100, y: nodes.length * 120 + 50 },
      data: {
        label: `${relationship.SOURCE_SCHEMA}.${relationship.SOURCE_TABLE}`,
        type: 'source',
        table: `${relationship.SOURCE_SCHEMA}.${relationship.SOURCE_TABLE}`,
        schema: relationship.SOURCE_SCHEMA,
        tableName: relationship.SOURCE_TABLE,
      },
      style: {
        background: '#dbeafe',
        border: '2px solid #3b82f6',
        borderRadius: '8px',
        padding: '10px',
      },
    };

    // Add target table node
    const targetNode = {
      id: `target_${relationship.TARGET_SCHEMA}_${relationship.TARGET_TABLE}_${Date.now()}`,
      type: 'default',
      position: { x: 400, y: nodes.length * 120 + 50 },
      data: {
        label: `${relationship.TARGET_SCHEMA}.${relationship.TARGET_TABLE}`,
        type: 'source',
        table: `${relationship.TARGET_SCHEMA}.${relationship.TARGET_TABLE}`,
        schema: relationship.TARGET_SCHEMA,
        tableName: relationship.TARGET_TABLE,
      },
      style: {
        background: '#dcfce7',
        border: '2px solid #22c55e',
        borderRadius: '8px',
        padding: '10px',
      },
    };

    // Add edge connecting them
    const edge = {
      id: `edge_${Date.now()}`,
      source: sourceNode.id,
      target: targetNode.id,
      label: `${relationship.SOURCE_COLUMN} → ${relationship.TARGET_COLUMN}`,
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      style: {
        stroke: '#6366f1',
        strokeWidth: 2,
      },
    };

    setNodes((nds) => [...nds, sourceNode, targetNode]);
    setEdges((eds) => [...eds, edge]);
    setShowRelationshipsModal(false);
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">Data Flow Visualizer</h1>
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-3 py-1.5 border"
            >
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name}
                </option>
              ))}
            </select>
            <select
              value={selectedFlow || ''}
              onChange={(e) => e.target.value && handleLoadFlow(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-3 py-1.5 border"
            >
              <option value="">Load Flow...</option>
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDiscoverRelationships}
              className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Discover Relationships
            </button>
            <button
              onClick={() => setShowImportSQLModal(true)}
              className="px-3 py-1.5 text-sm text-purple-700 bg-purple-50 border border-purple-300 rounded-md hover:bg-purple-100 flex items-center gap-1"
            >
              <span>📥</span>
              Import SQL
            </button>
            <button
              onClick={handleNewFlow}
              className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              New Flow
            </button>
            <button
              onClick={handleSaveFlow}
              disabled={saving}
              className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Flow'}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-2 text-sm text-red-600">{error}</div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 border-r border-gray-200 bg-white overflow-y-auto">
          <DatabaseBrowser
            connectionId={selectedConnection}
            onAddTable={handleAddTable}
          />
          <NodePalette
            onAddSource={handleAddSource}
            onAddTransformation={handleAddTransformation}
            onAddDestination={handleAddDestination}
            onAddGroup={handleAddGroup}
          />
        </div>

        {/* Canvas */}
        <div className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <MiniMap />
            <Background variant="dots" gap={12} size={1} />
          </ReactFlow>
        </div>

        {/* Right Sidebar */}
        {selectedNode && (
          <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
            <PropertiesPanel
              node={selectedNode}
              onUpdate={handleNodeUpdate}
              onDelete={handleNodeDelete}
            />
          </div>
        )}
      </div>

      {showMetadataModal && (
        <FlowMetadataModal
          metadata={flowMetadata}
          onSave={(metadata) => {
            setFlowMetadata(metadata);
            setShowMetadataModal(false);
          }}
          onCancel={() => setShowMetadataModal(false)}
        />
      )}

      {showRelationshipsModal && (
        <RelationshipsModal
          relationships={discoveredRelationships}
          onClose={() => setShowRelationshipsModal(false)}
          onAddToCanvas={handleAddRelationshipToCanvas}
        />
      )}

      {showImportSQLModal && (
        <ImportSQLModal
          onImport={handleImportSQL}
          onClose={() => setShowImportSQLModal(false)}
        />
      )}
    </div>
  );
}

export default FlowVisualizer;
