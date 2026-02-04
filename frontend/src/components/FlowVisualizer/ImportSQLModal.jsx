import React, { useState } from 'react';

function ImportSQLModal({ onImport, onClose }) {
  const [sqlCode, setSqlCode] = useState(`-- Example: Paste your SQL query here
SELECT 
  c.CustomerID,
  c.FirstName,
  c.LastName,
  COUNT(o.SalesOrderID) as TotalOrders
FROM SalesLT.Customer c
LEFT JOIN SalesLT.SalesOrderHeader o 
  ON c.CustomerID = o.CustomerID
GROUP BY c.CustomerID, c.FirstName, c.LastName`);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  const handleImport = async () => {
    if (!sqlCode.trim()) {
      setError('Please enter SQL code');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      await onImport(sqlCode);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-lg bg-white">
        <div className="flex justify-between items-center pb-3 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">📥</span>
            Import SQL to Canvas
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 text-2xl font-semibold"
          >
            &times;
          </button>
        </div>

        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-3">
            Paste your SQL query below and we'll automatically generate nodes and connections on your canvas.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <span>⚠️</span>
                {error}
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SQL Code
            </label>
            <textarea
              value={sqlCode}
              onChange={(e) => setSqlCode(e.target.value)}
              className="w-full h-96 font-mono text-sm p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Paste your SQL query here..."
              spellCheck="false"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <p className="text-xs text-gray-700">
              <strong>💡 Tip:</strong> The parser will extract:
            </p>
            <ul className="mt-1 text-xs text-gray-600 space-y-1 ml-4 list-disc">
              <li>Tables from FROM and JOIN clauses</li>
              <li>Common Table Expressions (CTEs)</li>
              <li>Column selections and transformations</li>
              <li>JOIN relationships</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-6 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-md hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center gap-2"
          >
            {importing ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Importing...
              </>
            ) : (
              <>
                <span>🚀</span>
                Import to Canvas
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportSQLModal;
