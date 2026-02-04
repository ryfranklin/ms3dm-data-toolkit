import React, { useState, useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { flowsApi } from '../../api/client';

function SQLParser() {
  const [sqlCode, setSqlCode] = useState(`-- Example SQL Query
SELECT 
  c.CustomerID,
  c.FirstName,
  c.LastName,
  COUNT(o.SalesOrderID) as TotalOrders,
  SUM(o.TotalDue) as TotalAmount
FROM SalesLT.Customer c
LEFT JOIN SalesLT.SalesOrderHeader o 
  ON c.CustomerID = o.CustomerID
WHERE c.CompanyName IS NOT NULL
GROUP BY c.CustomerID, c.FirstName, c.LastName
ORDER BY TotalAmount DESC`);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [parseResults, setParseResults] = useState(null);

  const handleParseSql = async () => {
    if (!sqlCode.trim()) {
      setError('Please enter SQL code to parse');
      return;
    }

    try {
      setParsing(true);
      setError(null);
      
      const result = await flowsApi.parseSql(sqlCode);
      
      setNodes(result.nodes || []);
      setEdges(result.edges || []);
      setParseResults(result);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleClearDiagram = () => {
    setNodes([]);
    setEdges([]);
    setParseResults(null);
    setError(null);
  };

  const handleLoadExample = () => {
    setSqlCode(`-- Complex Query with CTE
WITH CustomerStats AS (
  SELECT 
    c.CustomerID,
    c.FirstName + ' ' + c.LastName as FullName,
    COUNT(o.SalesOrderID) as OrderCount,
    SUM(o.TotalDue) as TotalSpent
  FROM SalesLT.Customer c
  LEFT JOIN SalesLT.SalesOrderHeader o 
    ON c.CustomerID = o.CustomerID
  GROUP BY c.CustomerID, c.FirstName, c.LastName
)
SELECT 
  cs.*,
  CASE 
    WHEN cs.TotalSpent > 10000 THEN 'Premium'
    WHEN cs.TotalSpent > 5000 THEN 'Gold'
    ELSE 'Standard'
  END as CustomerTier
FROM CustomerStats cs
WHERE cs.OrderCount > 0
ORDER BY cs.TotalSpent DESC`);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 shadow-lg">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <span className="text-3xl">🔍</span>
          SQL Code Parser & Visualizer
        </h1>
        <p className="text-indigo-100 mt-1 text-sm">
          Paste your SQL code to automatically generate a visual data flow diagram
        </p>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            {error}
          </p>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - SQL Editor */}
        <div className="w-1/2 border-r border-gray-200 bg-gray-50 flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-white">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>💻</span> SQL Code Editor
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleParseSql}
                disabled={parsing}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-semibold transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {parsing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Parsing...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    Parse & Diagram
                  </>
                )}
              </button>
              <button
                onClick={handleClearDiagram}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-all"
              >
                🗑️ Clear
              </button>
              <button
                onClick={handleLoadExample}
                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium transition-all"
              >
                📝 Load Example
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-4">
            <textarea
              value={sqlCode}
              onChange={(e) => setSqlCode(e.target.value)}
              className="w-full h-full font-mono text-sm p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white resize-none"
              placeholder="Paste your SQL code here..."
              spellCheck="false"
            />
          </div>

          {/* Parse Results Info */}
          {parseResults && (
            <div className="p-4 border-t border-gray-200 bg-white">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">📊 Parse Results:</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <span className="font-semibold">Tables:</span> {parseResults.tables?.length || 0}
                </div>
                <div className="p-2 bg-purple-50 rounded border border-purple-200">
                  <span className="font-semibold">CTEs:</span> {parseResults.ctes?.length || 0}
                </div>
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <span className="font-semibold">Columns:</span> {parseResults.columns?.length || 0}
                </div>
                <div className="p-2 bg-orange-50 rounded border border-orange-200">
                  <span className="font-semibold">Joins:</span> {parseResults.joins?.length || 0}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Diagram Visualization */}
        <div className="w-1/2 flex flex-col bg-white">
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span>📈</span> Data Flow Diagram
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              Visual representation of your SQL query's data flow
            </p>
          </div>
          
          <div className="flex-1 bg-gray-50">
            {nodes.length > 0 ? (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                attributionPosition="bottom-left"
              >
                <Controls />
                <MiniMap 
                  nodeColor={(node) => {
                    switch (node.data.type) {
                      case 'source_table': return '#3b82f6';
                      case 'cte': return '#8b5cf6';
                      case 'output': return '#10b981';
                      default: return '#94a3b8';
                    }
                  }}
                />
                <Background variant="dots" gap={12} size={1} />
              </ReactFlow>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-400">
                  <svg className="mx-auto h-24 w-24 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="mt-4 text-lg font-medium">No diagram yet</p>
                  <p className="text-sm mt-2">Enter SQL code and click "Parse & Diagram"</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SQLParser;
