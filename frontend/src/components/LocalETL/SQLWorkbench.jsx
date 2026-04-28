import React, { useState, useRef, useEffect, useCallback } from 'react';
import { localEtlApi } from '../../api/client';

const newCell = (sql = '') => ({
  id:
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  sql,
  result: null,
  error: null,
  running: false,
  exporting: false,
});

export default function SQLWorkbench() {
  const [cells, setCells] = useState(() => [newCell()]);
  const [focusedId, setFocusedId] = useState(null);
  const [pendingFocusId, setPendingFocusId] = useState(null);
  const textareaRefs = useRef({});

  const updateCell = useCallback((id, patch) => {
    setCells((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const runCell = useCallback(
    async (id) => {
      const cell = cells.find((c) => c.id === id);
      if (!cell || !cell.sql.trim() || cell.running) return;
      updateCell(id, { running: true, error: null, result: null });
      try {
        const res = await localEtlApi.query(cell.sql);
        updateCell(id, { result: res.data, running: false });
      } catch (err) {
        updateCell(id, { error: err.message, running: false });
      }
    },
    [cells, updateCell],
  );

  const addCell = useCallback((afterId, sql = '') => {
    const cell = newCell(sql);
    setCells((cs) => {
      if (afterId == null) return [...cs, cell];
      const idx = cs.findIndex((c) => c.id === afterId);
      if (idx === -1) return [...cs, cell];
      return [...cs.slice(0, idx + 1), cell, ...cs.slice(idx + 1)];
    });
    setPendingFocusId(cell.id);
    return cell.id;
  }, []);

  const deleteCell = useCallback((id) => {
    setCells((cs) => {
      if (cs.length <= 1) return [newCell()];
      return cs.filter((c) => c.id !== id);
    });
  }, []);

  const exportCell = useCallback(
    async (id) => {
      const cell = cells.find((c) => c.id === id);
      if (!cell || !cell.sql.trim() || cell.exporting) return;
      updateCell(id, { exporting: true });
      try {
        const blob = await localEtlApi.exportQuery(cell.sql);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'query_results.csv';
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        updateCell(id, { error: err.message });
      } finally {
        updateCell(id, { exporting: false });
      }
    },
    [cells, updateCell],
  );

  // Apply pending focus once the new cell's textarea has mounted.
  useEffect(() => {
    if (!pendingFocusId) return;
    const ta = textareaRefs.current[pendingFocusId];
    if (ta) {
      ta.focus();
      setFocusedId(pendingFocusId);
      setPendingFocusId(null);
    }
  }, [pendingFocusId, cells]);

  // FileManager → workbench bridge: drop a SELECT into the focused empty cell,
  // or append a new cell if the focused one already has SQL.
  useEffect(() => {
    const handler = (e) => {
      const table = e.detail;
      const sql = `SELECT * FROM ${table} LIMIT 100`;
      const target = focusedId
        ? cells.find((c) => c.id === focusedId)
        : cells[cells.length - 1];
      if (target && !target.sql.trim()) {
        updateCell(target.id, { sql });
        setPendingFocusId(target.id);
      } else {
        addCell(target?.id, sql);
      }
    };
    window.addEventListener('localetl:insert-table', handler);
    return () => window.removeEventListener('localetl:insert-table', handler);
  }, [cells, focusedId, addCell, updateCell]);

  const handleKeyDown = (e, cell, idx) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runCell(cell.id);
      return;
    }
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      runCell(cell.id);
      const next = cells[idx + 1];
      if (next) {
        setPendingFocusId(next.id);
      } else {
        addCell(cell.id);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <div className="flex-1 overflow-auto px-6 py-4">
        {cells.map((cell, idx) => (
          <Cell
            key={cell.id}
            cell={cell}
            index={idx + 1}
            onChange={(sql) => updateCell(cell.id, { sql })}
            onRun={() => runCell(cell.id)}
            onDelete={() => deleteCell(cell.id)}
            onExport={() => exportCell(cell.id)}
            onAddBelow={() => addCell(cell.id)}
            onKeyDown={(e) => handleKeyDown(e, cell, idx)}
            onFocus={() => setFocusedId(cell.id)}
            registerRef={(el) => {
              if (el) textareaRefs.current[cell.id] = el;
              else delete textareaRefs.current[cell.id];
            }}
          />
        ))}

        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => addCell(null)}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add cell
          </button>
          <span className="text-[11px] text-gray-400">
            Shift+Enter runs and advances · Ctrl/⌘+Enter runs in place · Files in storage are auto-registered as tables
          </span>
        </div>
      </div>
    </div>
  );
}

function Cell({
  cell,
  index,
  onChange,
  onRun,
  onDelete,
  onExport,
  onAddBelow,
  onKeyDown,
  onFocus,
  registerRef,
}) {
  return (
    <div className="mb-4 bg-white border border-gray-200 rounded shadow-sm">
      <div className="flex">
        <div className="flex-shrink-0 w-14 px-2 py-3 text-right text-xs font-mono text-gray-400 select-none">
          [{cell.running ? '*' : index}]
        </div>
        <div className="flex-1 min-w-0">
          <textarea
            ref={registerRef}
            value={cell.sql}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            placeholder="SELECT * FROM customers WHERE state = 'WA'"
            className="w-full h-24 px-3 py-3 text-sm font-mono resize-y focus:outline-none border-0"
            spellCheck={false}
          />
          <div className="px-3 py-1.5 flex items-center gap-2 bg-gray-50 border-t border-gray-100">
            <button
              onClick={onRun}
              disabled={cell.running || !cell.sql.trim()}
              className="px-2.5 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
            >
              {cell.running ? (
                'Running…'
              ) : (
                <>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  Run
                </>
              )}
            </button>
            <button
              onClick={onAddBelow}
              className="px-2.5 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
              title="Insert cell below"
            >
              + Below
            </button>
            <div className="flex-1" />
            {cell.result && (
              <button
                onClick={onExport}
                disabled={cell.exporting}
                className="px-2.5 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {cell.exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            )}
            <button
              onClick={onDelete}
              className="px-2.5 py-1 text-xs text-red-600 bg-white border border-red-200 rounded hover:bg-red-50"
              title="Delete cell"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {(cell.error || cell.result) && (
        <div className="border-t border-gray-100 px-3 py-3">
          {cell.error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <pre className="whitespace-pre-wrap font-mono text-xs">{cell.error}</pre>
            </div>
          )}
          {cell.result && (
            <div>
              <div className="text-xs text-gray-500 mb-2">
                {cell.result.row_count} row{cell.result.row_count !== 1 ? 's' : ''}
                {cell.result.truncated && ' (truncated)'}
                {' — '}
                {cell.result.duration_ms}ms
              </div>
              {cell.result.columns.length > 0 && (
                <div className="overflow-auto border border-gray-200 rounded max-h-96">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        {cell.result.columns.map((col) => (
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
                      {cell.result.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {row.map((c, j) => (
                            <td
                              key={j}
                              className="px-3 py-1.5 text-xs text-gray-700 whitespace-nowrap font-mono"
                            >
                              {c === null ? (
                                <span className="text-gray-300 italic">NULL</span>
                              ) : (
                                String(c)
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
        </div>
      )}
    </div>
  );
}
