import React, { useState, useRef, useEffect, useCallback } from 'react';
import { localEtlApi } from '../../api/client';

export default function SQLWorkbench() {
  const [sql, setSql] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const textareaRef = useRef(null);

  // Listen for insert-table events from FileManager
  useEffect(() => {
    const handler = (e) => {
      const table = e.detail;
      setSql((prev) => {
        if (prev.trim()) return prev;
        return `SELECT * FROM ${table} LIMIT 100`;
      });
    };
    window.addEventListener('localetl:insert-table', handler);
    return () => window.removeEventListener('localetl:insert-table', handler);
  }, []);

  const runQuery = useCallback(async () => {
    if (!sql.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await localEtlApi.query(sql);
      setResult(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }, [sql, running]);

  const exportCsv = async () => {
    if (!sql.trim() || exporting) return;
    setExporting(true);
    try {
      const blob = await localEtlApi.exportQuery(sql);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'query_results.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  // Ctrl+Enter to run
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* SQL editor */}
      <div className="border-b border-gray-200 flex flex-col">
        <textarea
          ref={textareaRef}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="SELECT * FROM customers WHERE state = 'WA'"
          className="w-full h-32 px-4 py-3 text-sm font-mono resize-none focus:outline-none border-0"
          spellCheck={false}
        />
        <div className="px-4 py-2 flex items-center gap-2 bg-gray-50 border-t border-gray-100">
          <button
            onClick={runQuery}
            disabled={running || !sql.trim()}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {running ? (
              'Running...'
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                Run
              </>
            )}
          </button>
          <span className="text-[10px] text-gray-400">Ctrl+Enter</span>
          <div className="flex-1" />
          {result && (
            <button
              onClick={exportCsv}
              disabled={exporting}
              className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          )}
        </div>
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre>
          </div>
        )}

        {result && (
          <div className="p-4">
            <div className="text-xs text-gray-500 mb-2">
              {result.row_count} row{result.row_count !== 1 ? 's' : ''}
              {result.truncated && ' (truncated)'}
              {' — '}
              {result.duration_ms}ms
            </div>

            {result.columns.length > 0 && (
              <div className="overflow-auto border border-gray-200 rounded">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {result.columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="px-3 py-1.5 text-xs text-gray-700 whitespace-nowrap font-mono"
                          >
                            {cell === null ? (
                              <span className="text-gray-300 italic">NULL</span>
                            ) : (
                              String(cell)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!result && !error && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Write a SQL query and press Run to see results.
            <br />
            Files in your storage directory are auto-registered as tables.
          </div>
        )}
      </div>
    </div>
  );
}
