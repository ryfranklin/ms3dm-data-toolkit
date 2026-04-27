import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { localEtlApi } from '../../api/client';
import { formatDuration as fmtDuration } from '../../lib/etlUtils';

const STATUS_STYLES = {
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
};

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const ExecutionHistory = forwardRef(function ExecutionHistory({ pipelineId = null, limit = 50 }, ref) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailRun, setDetailRun] = useState(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit };
      if (pipelineId) params.pipeline_id = pipelineId;
      const res = await localEtlApi.listPipelineRuns(params);
      setRuns(res.data?.runs || []);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [pipelineId, limit]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Let parents trigger a refresh after a new run completes.
  useImperativeHandle(ref, () => ({ refresh: fetchRuns }), [fetchRuns]);

  if (loading) {
    return <p className="text-sm text-gray-500">Loading run history…</p>;
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-500">
        No pipeline runs yet. Run a pipeline to see its history here.
      </div>
    );
  }

  return (
    <>
      <div className="border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">When</th>
              <th className="text-left px-3 py-2 font-medium">Pipeline</th>
              <th className="text-left px-3 py-2 font-medium">Source → Destination</th>
              <th className="text-left px-3 py-2 font-medium">Mode</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-right px-3 py-2 font-medium">Rows</th>
              <th className="text-right px-3 py-2 font-medium">Duration</th>
              <th className="px-3 py-2 font-medium w-8"></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.run_id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-1.5 text-xs text-gray-700 whitespace-nowrap">
                  {fmtTime(r.started_at)}
                </td>
                <td className="px-3 py-1.5 text-xs">
                  {r.pipeline_name ? (
                    <span className="text-gray-900">{r.pipeline_name}</span>
                  ) : (
                    <span className="text-gray-400 italic">ad-hoc</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-xs font-mono text-gray-700 truncate max-w-md">
                  {r.source_file} → {r.destination}
                </td>
                <td className="px-3 py-1.5 text-xs font-mono text-gray-600">{r.mode}</td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded ${STATUS_STYLES[r.status] || 'bg-gray-100 text-gray-700'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-xs text-right text-gray-700">
                  {r.rows_loaded != null ? r.rows_loaded.toLocaleString() : '—'}
                </td>
                <td className="px-3 py-1.5 text-xs text-right text-gray-700">
                  {fmtDuration(r.duration_ms)}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    onClick={() => setDetailRun(r)}
                    className="text-xs px-2 py-0.5 text-blue-700 hover:bg-blue-100 rounded"
                    title="View details"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailRun && <RunDetailModal run={detailRun} onClose={() => setDetailRun(null)} />}
    </>
  );
});

export default ExecutionHistory;

// ----- Detail modal ----- //

function RunDetailModal({ run, onClose }) {
  const isError = run.status === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Run details</h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{run.run_id}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                STATUS_STYLES[run.status] || 'bg-gray-100 text-gray-700'
              }`}
            >
              {run.status}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
              &times;
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          <Section title="Pipeline">
            <DetailRow label="Name" value={run.pipeline_name || <span className="text-gray-400 italic">ad-hoc (not saved)</span>} />
            {run.pipeline_id && <DetailRow label="ID" value={<code className="font-mono text-xs">{run.pipeline_id}</code>} />}
          </Section>

          <Section title="Source">
            <DetailRow label="File" value={<code className="font-mono">{run.source_file}</code>} />
          </Section>

          <Section title="Destination">
            <DetailRow label="Connection" value={<code className="font-mono text-xs">{run.connection_id}</code>} />
            <DetailRow label="Table" value={<code className="font-mono">{run.destination}</code>} />
            <DetailRow label="Mode" value={<code className="font-mono">{run.mode}</code>} />
          </Section>

          <Section title="Result">
            <DetailRow label="Started" value={fmtTime(run.started_at)} />
            <DetailRow label="Duration" value={fmtDuration(run.duration_ms)} />
            <DetailRow
              label="Rows loaded"
              value={run.rows_loaded != null ? run.rows_loaded.toLocaleString() : '—'}
            />
          </Section>

          {isError && run.error_message && (
            <Section title="Error">
              <pre className="text-xs text-red-800 bg-red-50 border border-red-200 rounded p-3 whitespace-pre-wrap break-all">
                {run.error_message}
              </pre>
            </Section>
          )}
        </div>

        <div className="px-6 py-3 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <div className="w-28 text-xs text-gray-500">{label}</div>
      <div className="flex-1 text-gray-900 break-all">{value}</div>
    </div>
  );
}
