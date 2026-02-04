import React, { useEffect, useRef, useState } from 'react';

function ERDiagram({ currentTable, relationships, onTableClick }) {
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Generate SQL JOIN statement for a single relationship
  const generateJoinSQL = (rel) => {
    const currentAlias = currentTable.table.substring(0, 2).toLowerCase();
    const refAlias = rel.referenced_table.substring(0, 2).toLowerCase();
    
    return `JOIN [${rel.referenced_schema}].[${rel.referenced_table}] ${refAlias}
  ON ${currentAlias}.[${rel.column}] = ${refAlias}.[${rel.referenced_column}]`;
  };

  // Generate complete SQL with all JOINs
  const generateCompleteJoinSQL = () => {
    const currentAlias = currentTable.table.substring(0, 2).toLowerCase();
    let sql = `SELECT *\nFROM [${currentTable.schema}].[${currentTable.table}] ${currentAlias}\n`;
    
    relationships.forEach((rel) => {
      sql += generateJoinSQL(rel) + '\n';
    });
    
    return sql;
  };

  useEffect(() => {
    // Update dimensions based on container
    const updateDimensions = () => {
      if (svgRef.current?.parentElement) {
        const width = svgRef.current.parentElement.clientWidth;
        setDimensions({ width, height: 600 });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  if (!relationships || relationships.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-6xl mb-4">🔗</div>
          <p className="text-gray-600 font-medium">No relationships to visualize</p>
          <p className="text-sm text-gray-500 mt-2">This table has no foreign key relationships</p>
        </div>
      </div>
    );
  }

  // Layout configuration
  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;
  const boxWidth = 200;
  const boxHeight = 80;
  const radius = Math.min(dimensions.width, dimensions.height) / 3;

  // Calculate positions for related tables in a circle around the center
  const relatedTables = relationships.map((rel, idx) => ({
    schema: rel.referenced_schema,
    table: rel.referenced_table,
    column: rel.referenced_column,
    fkColumn: rel.column,
    fkName: rel.name,
    id: `${rel.referenced_schema}.${rel.referenced_table}`
  }));

  // Remove duplicates
  const uniqueTables = relatedTables.reduce((acc, table) => {
    if (!acc.find(t => t.id === table.id)) {
      acc.push(table);
    }
    return acc;
  }, []);

  // Position tables in a circle
  const angleStep = (2 * Math.PI) / uniqueTables.length;
  const positionedTables = uniqueTables.map((table, idx) => {
    const angle = idx * angleStep - Math.PI / 2; // Start from top
    return {
      ...table,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
  });

  // Center table position
  const centerTable = {
    x: centerX,
    y: centerY,
    schema: currentTable.schema,
    table: currentTable.table
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Entity Relationship Diagram</h3>
          <p className="text-sm text-gray-600 mt-1">
            Visual representation of {relationships.length} relationship{relationships.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-600 rounded"></div>
            <span className="text-gray-600">Current Table</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-gray-600">Referenced Tables</span>
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="border border-gray-200 rounded bg-gray-50"
      >
        {/* Define arrow marker */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill="#6B7280"
            />
          </marker>
        </defs>

        {/* Draw relationship lines from center to related tables */}
        {positionedTables.map((table, idx) => {
          // Calculate connection points
          const dx = table.x - centerTable.x;
          const dy = table.y - centerTable.y;
          const angle = Math.atan2(dy, dx);
          
          // Start point (edge of center box)
          const startX = centerTable.x + (boxWidth / 2) * Math.cos(angle);
          const startY = centerTable.y + (boxHeight / 2) * Math.sin(angle);
          
          // End point (edge of related table box)
          const endX = table.x - (boxWidth / 2) * Math.cos(angle);
          const endY = table.y - (boxHeight / 2) * Math.sin(angle);

          // Get the specific FK column for this relationship
          const rel = relationships.find(
            r => r.referenced_schema === table.schema && 
                 r.referenced_table === table.table
          );

          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;

          return (
            <g key={idx}>
              {/* Relationship line */}
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#6B7280"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
                className="transition-all hover:stroke-blue-500"
              />
              
              {/* FK label with SQL hint */}
              {rel && (
                <g>
                  {/* Background for better readability */}
                  <rect
                    x={midX - 50}
                    y={midY - 25}
                    width="100"
                    height="30"
                    fill="white"
                    stroke="#E5E7EB"
                    strokeWidth="1"
                    rx="4"
                    opacity="0.95"
                  />
                  
                  {/* FK column name */}
                  <text
                    x={midX}
                    y={midY - 10}
                    className="text-xs fill-blue-600 font-mono font-semibold"
                    textAnchor="middle"
                    style={{ fontSize: '11px', pointerEvents: 'none' }}
                  >
                    {rel.column}
                  </text>
                  
                  {/* SQL hint */}
                  <text
                    x={midX}
                    y={midY + 5}
                    className="text-xs fill-gray-500 font-mono"
                    textAnchor="middle"
                    style={{ fontSize: '9px', pointerEvents: 'none' }}
                  >
                    = {rel.referenced_column}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Draw center table (current table) */}
        <g>
          <rect
            x={centerTable.x - boxWidth / 2}
            y={centerTable.y - boxHeight / 2}
            width={boxWidth}
            height={boxHeight}
            fill="#2563EB"
            stroke="#1E40AF"
            strokeWidth="2"
            rx="8"
            className="drop-shadow-lg"
          />
          <text
            x={centerTable.x}
            y={centerTable.y - 10}
            className="fill-white font-semibold"
            textAnchor="middle"
            style={{ fontSize: '14px', pointerEvents: 'none' }}
          >
            {centerTable.table}
          </text>
          <text
            x={centerTable.x}
            y={centerTable.y + 10}
            className="fill-blue-100 text-xs"
            textAnchor="middle"
            style={{ fontSize: '12px', pointerEvents: 'none' }}
          >
            {centerTable.schema}
          </text>
          <text
            x={centerTable.x}
            y={centerTable.y + 28}
            className="fill-blue-200 text-xs italic"
            textAnchor="middle"
            style={{ fontSize: '11px', pointerEvents: 'none' }}
          >
            (Current Table)
          </text>
        </g>

        {/* Draw related tables */}
        {positionedTables.map((table, idx) => {
          // Count relationships to this table
          const relCount = relationships.filter(
            r => r.referenced_schema === table.schema && 
                 r.referenced_table === table.table
          ).length;

          return (
            <g
              key={idx}
              className="cursor-pointer transition-transform hover:scale-105"
              onClick={() => onTableClick && onTableClick(table.schema, table.table)}
            >
              <rect
                x={table.x - boxWidth / 2}
                y={table.y - boxHeight / 2}
                width={boxWidth}
                height={boxHeight}
                fill="#10B981"
                stroke="#059669"
                strokeWidth="2"
                rx="8"
                className="drop-shadow-md hover:drop-shadow-xl transition-all"
              />
              <text
                x={table.x}
                y={table.y - 10}
                className="fill-white font-semibold"
                textAnchor="middle"
                style={{ fontSize: '14px', pointerEvents: 'none' }}
              >
                {table.table}
              </text>
              <text
                x={table.x}
                y={table.y + 10}
                className="fill-green-100 text-xs"
                textAnchor="middle"
                style={{ fontSize: '12px', pointerEvents: 'none' }}
              >
                {table.schema}
              </text>
              {relCount > 1 && (
                <text
                  x={table.x}
                  y={table.y + 28}
                  className="fill-green-200 text-xs"
                  textAnchor="middle"
                  style={{ fontSize: '11px', pointerEvents: 'none' }}
                >
                  ({relCount} FKs)
                </text>
              )}
              
              {/* Click indicator */}
              <text
                x={table.x}
                y={table.y + (relCount > 1 ? 43 : 30)}
                className="fill-white text-xs opacity-0 group-hover:opacity-100"
                textAnchor="middle"
                style={{ fontSize: '10px', pointerEvents: 'none' }}
              >
                Click to view →
              </text>
            </g>
          );
        })}
      </svg>

      {/* Complete SQL Query Example */}
      <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Complete Query Example</h4>
            <p className="text-xs text-gray-600 mt-1">Ready-to-use SQL with all relationships</p>
          </div>
          <button
            onClick={() => {
              const sql = generateCompleteJoinSQL();
              navigator.clipboard.writeText(sql);
              alert('✅ Complete SQL query copied to clipboard!');
            }}
            className="px-3 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium shadow-sm flex items-center space-x-1"
          >
            <span>📋</span>
            <span>Copy Query</span>
          </button>
        </div>
        <div className="bg-gray-900 rounded-md p-4 font-mono text-xs text-green-400 overflow-x-auto">
          <pre className="whitespace-pre">{generateCompleteJoinSQL()}</pre>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Legend</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600">
          <div className="flex items-center space-x-2">
            <span className="text-lg">→</span>
            <span>Arrow points to referenced table (parent)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg">🔗</span>
            <span>Labels show foreign key column names</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg">👆</span>
            <span>Click green tables to navigate</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg">📊</span>
            <span>Multiple FKs indicated in table</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg">💻</span>
            <span>Copy SQL snippets for each relationship</span>
          </div>
        </div>
      </div>

      {/* Detailed relationships list with SQL */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">Individual JOIN Statements</h4>
          <p className="text-xs text-gray-500">Click any "Copy" button to copy that specific JOIN</p>
        </div>
        <div className="space-y-3">
          {relationships.map((rel, idx) => {
            const joinSQL = generateJoinSQL(rel);
            return (
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors overflow-hidden"
              >
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">🔗</span>
                      <div>
                        <p className="font-mono text-sm text-gray-900">
                          <span className="font-semibold text-blue-600">{rel.column}</span>
                          <span className="text-gray-500 mx-2">→</span>
                          <span
                            className="text-green-600 hover:underline cursor-pointer"
                            onClick={() => onTableClick && onTableClick(rel.referenced_schema, rel.referenced_table)}
                          >
                            {rel.referenced_schema}.{rel.referenced_table}.{rel.referenced_column}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{rel.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(joinSQL);
                        alert('SQL copied to clipboard!');
                      }}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-medium"
                      title="Copy this JOIN statement"
                    >
                      📋 Copy
                    </button>
                  </div>
                  
                  {/* SQL Code */}
                  <div className="mt-2 bg-gray-900 rounded-md p-3 font-mono text-xs text-green-400 overflow-x-auto">
                    <pre className="whitespace-pre">{joinSQL}</pre>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ERDiagram;
