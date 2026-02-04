import React, { useState, useEffect } from 'react';
import { expectationsApi } from '../../api/client';

function CheckCanvas({ 
  expectations, 
  selectedExpectation, 
  selectedTable,
  selectedConnection,
  onSelectExpectation, 
  onDeleteExpectation,
  onUpdateTable 
}) {
  const [tableSchema, setTableSchema] = useState(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [availableTables, setAvailableTables] = useState({ schemas: [] });
  const [loadingTables, setLoadingTables] = useState(false);
  const [availableTablesForSchema, setAvailableTablesForSchema] = useState([]);
  
  // Fetch available tables when connection changes
  useEffect(() => {
    if (selectedConnection) {
      fetchAvailableTables();
    }
  }, [selectedConnection]);
  
  // Update available tables for selected schema
  useEffect(() => {
    if (selectedTable.schema && availableTables?.schemas?.length > 0) {
      const schemaInfo = availableTables.schemas.find(s => s.schema === selectedTable.schema);
      setAvailableTablesForSchema(schemaInfo ? schemaInfo.tables : []);
    } else {
      setAvailableTablesForSchema([]);
    }
  }, [selectedTable.schema, availableTables]);
  
  // Fetch table schema when table changes
  useEffect(() => {
    if (selectedTable.schema && selectedTable.table && selectedConnection) {
      fetchTableSchema();
    } else {
      setTableSchema(null);
    }
  }, [selectedTable.schema, selectedTable.table, selectedConnection]);
  
  const fetchAvailableTables = async () => {
    setLoadingTables(true);
    try {
      const response = await expectationsApi.getAvailableTables({
        connection_id: selectedConnection
      });
      // Axios interceptor already unwraps response.data, so response IS the data
      setAvailableTables(response || { schemas: [] });
    } catch (error) {
      console.error('Error fetching available tables:', error);
      setAvailableTables({ schemas: [], error: 'Failed to load tables' });
    } finally {
      setLoadingTables(false);
    }
  };
  
  const fetchTableSchema = async () => {
    setLoadingSchema(true);
    try {
      const response = await expectationsApi.getTableSchema({
        connection_id: selectedConnection,
        schema: selectedTable.schema,
        table: selectedTable.table
      });
      // Axios interceptor already unwraps response.data, so response IS the data
      setTableSchema(response);
      setShowSchema(true);
    } catch (error) {
      console.error('Error fetching table schema:', error);
      setTableSchema({ error: 'Failed to load table schema' });
    } finally {
      setLoadingSchema(false);
    }
  };
  return (
    <div className="p-6">
      {/* Table Selector */}
      <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">Target Table</h3>
          {loadingTables && (
            <span className="text-xs text-gray-500 italic">Loading tables...</span>
          )}
          {availableTables?.schemas?.length > 0 && (
            <span className="text-xs text-gray-500">
              {availableTables.total_tables} tables available
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Schema</label>
            <select
              value={selectedTable.schema}
              onChange={(e) => onUpdateTable({ 
                schema: e.target.value, 
                table: '' // Reset table when schema changes
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              disabled={loadingTables}
            >
              <option value="">Select schema...</option>
              {availableTables?.schemas?.map((schemaInfo) => (
                <option key={schemaInfo.schema} value={schemaInfo.schema}>
                  {schemaInfo.schema} ({schemaInfo.tables.length} tables)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Table</label>
            <select
              value={selectedTable.table}
              onChange={(e) => onUpdateTable({ ...selectedTable, table: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              disabled={!selectedTable.schema || availableTablesForSchema.length === 0}
            >
              <option value="">Select table...</option>
              {availableTablesForSchema.map((tableName) => (
                <option key={tableName} value={tableName}>
                  {tableName}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Table Schema Display */}
        {tableSchema && !tableSchema.error && (
          <div className="mt-3">
            <button
              onClick={() => setShowSchema(!showSchema)}
              className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600 font-medium transition-colors"
            >
              <span>{showSchema ? '▼' : '▶'}</span>
              <span>Table Schema ({tableSchema.column_count} columns)</span>
            </button>
            
            {showSchema && (
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
                <div className="p-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">
                    {tableSchema.schema}.{tableSchema.table}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(tableSchema.sql);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    title="Copy to clipboard"
                  >
                    📋 Copy SQL
                  </button>
                </div>
                <pre className="p-3 text-xs font-mono text-gray-800 overflow-x-auto max-h-64">
                  {tableSchema.sql}
                </pre>
              </div>
            )}
          </div>
        )}
        
        {loadingSchema && (
          <div className="mt-3 text-xs text-gray-500 italic">
            Loading table schema...
          </div>
        )}
        
        {tableSchema?.error && (
          <div className="mt-3 text-xs text-red-600">
            {tableSchema.error}
          </div>
        )}
      </div>

      {/* Checks List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700">
            Quality Checks ({expectations.length})
          </h3>
        </div>

        {expectations.length === 0 ? (
          <div className="text-center py-12 bg-white border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm text-gray-600 mb-2">No checks added yet</p>
            <p className="text-xs text-gray-500">
              Click checks from the library on the left to add them
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {expectations.map((expectation, index) => (
              <div
                key={expectation.id}
                onClick={() => onSelectExpectation(expectation)}
                className={`
                  bg-white border-2 rounded-lg p-4 cursor-pointer transition-all
                  ${selectedExpectation?.id === expectation.id 
                    ? 'border-blue-500 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start flex-1">
                    <div className="text-2xl mr-3">{expectation.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                          #{index + 1}
                        </span>
                        <h4 className="font-medium text-sm text-gray-900">
                          {expectation.name}
                        </h4>
                        {(!expectation.target?.schema || !expectation.target?.table) ? (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
                            ⚠ No target
                          </span>
                        ) : (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded font-mono">
                            {expectation.target.schema}.{expectation.target.table}
                          </span>
                        )}
                      </div>
                      
                      {expectation.column && (
                        <p className="text-xs text-gray-600 mb-1">
                          Column: <span className="font-mono bg-blue-50 px-1.5 py-0.5 rounded">
                            {expectation.column}
                          </span>
                        </p>
                      )}
                      
                      {expectation.params && Object.keys(expectation.params).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Object.entries(expectation.params).map(([key, value]) => (
                            <span key={key} className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-700">
                              {key}: <span className="font-medium">{value}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-500 mt-2">
                        {expectation.description}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteExpectation(expectation.id);
                    }}
                    className="ml-3 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete check"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="width" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CheckCanvas;
