import React, { useState, useEffect, useCallback, useRef } from 'react';
import { localEtlApi } from '../../api/client';
import PipelineWizard from './PipelineWizard';
import ExecutionHistory from './ExecutionHistory';
import RunProgress, { usePipelineRun } from './RunProgress';

export default function ETLPipelinePanel({ files, storagePath, onFilesChanged, onGoToTargets, targetsVersion }) {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState(null);  // pipeline being edited (null for create)
  const [runModalPipeline, setRunModalPipeline] = useState(null);  // pipeline whose run modal is open
  const [rerunning, setRerunning] = useState(null);  // pipeline id currently re-running
  const [rerunMessage, setRerunMessage] = useState(null);
  const historyRef = useRef(null);

  const fetchPipelines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await localEtlApi.listPipelines();
      setPipelines(res.data.pipelines || []);
    } catch {
      setPipelines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const refreshHistory = () => historyRef.current?.refresh();

  // Kicks off a re-run and returns the run_id so the modal can poll for
  // progress. The async load completes in the background; we show progress
  // via RunProgress, then refresh pipelines + history when finished.
  const startRerun = async (p, sourceFileOverride = null) => {
    setRerunning(p.id);
    setRerunMessage(null);
    try {
      const payload = sourceFileOverride ? { source_file: sourceFileOverride } : {};
      const res = await localEtlApi.runSavedPipeline(p.id, payload);
      return res.data?.run_id || null;
    } catch (err) {
      setRerunMessage({ type: 'error', text: err.message });
      refreshHistory();
      setRerunning(null);
      return null;
    }
  };

  const handleRerunFinished = (final) => {
    setRerunning(null);
    if (final.status === 'success') {
      setRerunMessage({
        type: 'success',
        text: `Loaded ${final.rows_loaded?.toLocaleString?.() ?? final.rows_loaded} rows`,
      });
    } else {
      setRerunMessage({ type: 'error', text: final.error || 'Pipeline run failed' });
    }
    fetchPipelines();
    refreshHistory();
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete pipeline "${p.name}"? Data already loaded into the destination table is not affected. Run history is kept.`)) return;
    try {
      await localEtlApi.deletePipeline(p.id);
      fetchPipelines();
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">ETL Pipelines</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Load CSV (and other flat files) into SQL Server tables.
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          + New Pipeline
        </button>
      </div>

      {/* Re-run feedback */}
      {rerunMessage && (
        <div
          className={`mx-4 mt-3 px-3 py-2 text-sm rounded border ${
            rerunMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {rerunMessage.text}
          <button onClick={() => setRerunMessage(null)} className="float-right text-xs opacity-70 hover:opacity-100">
            dismiss
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        <section>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Saved pipelines</h3>
          {loading ? (
            <p className="text-sm text-gray-500">Loading pipelines…</p>
          ) : pipelines.length === 0 ? (
            <EmptyState onCreate={() => setShowWizard(true)} hasFiles={files.length > 0} storagePath={storagePath} />
          ) : (
            <div className="space-y-2">
              {pipelines.map((p) => (
                <PipelineCard
                  key={p.id}
                  pipeline={p}
                  onRerun={() => setRunModalPipeline(p)}
                  onEdit={() => { setEditingPipeline(p); setShowWizard(true); }}
                  onDelete={() => handleDelete(p)}
                  running={rerunning === p.id}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Execution history</h3>
          <ExecutionHistory ref={historyRef} limit={50} />
        </section>
      </div>

      {runModalPipeline && (
        <RunPipelineModal
          pipeline={runModalPipeline}
          files={files}
          startRerun={startRerun}
          onFinished={handleRerunFinished}
          onClose={() => { setRunModalPipeline(null); setRerunning(null); }}
        />
      )}

      {showWizard && (
        <PipelineWizard
          key={editingPipeline?.id || 'new'}  // remount when switching between pipelines
          files={files}
          editingPipeline={editingPipeline}
          onClose={() => { setShowWizard(false); setEditingPipeline(null); }}
          onComplete={() => { fetchPipelines(); refreshHistory(); }}
          onFilesChanged={onFilesChanged}
          onGoToTargets={() => { setShowWizard(false); setEditingPipeline(null); onGoToTargets?.(); }}
          targetsVersion={targetsVersion}
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate, hasFiles, storagePath }) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
      <h3 className="text-sm font-medium text-gray-900">No pipelines yet</h3>
      <p className="text-xs text-gray-500 mt-1">
        {hasFiles
          ? 'Build a pipeline to load a file from the Sandbox into SQL Server.'
          : `Upload a file to ${storagePath} or in the wizard to get started.`}
      </p>
      <button
        onClick={onCreate}
        className="mt-4 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
      >
        Create your first pipeline
      </button>
    </div>
  );
}

function RunPipelineModal({ pipeline, files, startRerun, onFinished, onClose }) {
  const fileType = (pipeline.source_file_type || '').toLowerCase();
  const compatibleFiles = fileType
    ? files.filter((f) => (f.type || '').toLowerCase() === fileType)
    : files;

  const savedStillExists = compatibleFiles.some((f) => f.name === pipeline.source_file);
  const [selected, setSelected] = useState(
    savedStillExists ? pipeline.source_file : (compatibleFiles[0]?.name || '')
  );
  const [starting, setStarting] = useState(false);
  const [runId, setRunId] = useState(null);

  const liveRun = usePipelineRun(runId, { onFinished });

  const canRun = !!selected && !starting && !runId;

  const handleRun = async () => {
    setStarting(true);
    const id = await startRerun(pipeline, selected !== pipeline.source_file ? selected : null);
    setStarting(false);
    if (id) setRunId(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={runId ? undefined : onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Run pipeline</h2>
            <p className="text-xs text-gray-500 mt-0.5">{pipeline.name}</p>
          </div>
          <button
            onClick={onClose}
            disabled={runId && liveRun?.status !== 'success' && liveRun?.status !== 'error'}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none disabled:opacity-30"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div className="text-sm text-gray-700">
            Loading into{' '}
            <code className="font-mono text-gray-900">{pipeline.schema}.{pipeline.table}</code>
            {' '}using mode{' '}
            <code className="font-mono text-gray-900">{pipeline.mode}</code>.
          </div>

          {!runId && compatibleFiles.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
              No <code className="font-mono">.{fileType || '?'}</code> files in storage. Upload one in the Sandbox or via the wizard, then re-run.
            </div>
          )}

          {!runId && compatibleFiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source file{fileType && <span className="text-gray-500"> (.{fileType})</span>}
              </label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              >
                {compatibleFiles.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}{f.name === pipeline.source_file ? '  (last used)' : ''}
                  </option>
                ))}
              </select>
              {!savedStillExists && pipeline.source_file && (
                <p className="text-xs text-amber-700 mt-1">
                  Last-used file <code className="font-mono">{pipeline.source_file}</code> is no longer in storage. Pick another.
                </p>
              )}
            </div>
          )}

          {runId && (
            <div className="border border-gray-200 bg-gray-50 rounded p-3">
              <RunProgress run={liveRun} />
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t bg-gray-50 flex justify-end gap-2">
          {!runId && (
            <>
              <button
                onClick={onClose}
                disabled={starting}
                className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleRun}
                disabled={!canRun}
                className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {starting ? 'Starting…' : 'Run'}
              </button>
            </>
          )}
          {runId && (liveRun?.status === 'success' || liveRun?.status === 'error') && (
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineCard({ pipeline, onRerun, onEdit, onDelete, running }) {
  const modeLabel = {
    create: 'CREATE',
    truncate_insert: 'TRUNCATE + INSERT',
    upsert: 'UPSERT',
  }[pipeline.mode] || pipeline.mode;

  const lastRunBadge = pipeline.last_run_status === 'error'
    ? <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-800">last run failed</span>
    : null;

  const fileTypeBadge = pipeline.source_file_type
    ? <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-mono uppercase">.{pipeline.source_file_type}</span>
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded p-3 flex items-center justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-900 truncate">{pipeline.name}</h3>
          {fileTypeBadge}
          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded font-mono">{modeLabel}</span>
          {lastRunBadge}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          <code className="font-mono">{pipeline.source_file || `(any .${pipeline.source_file_type})`}</code>
          {' → '}
          <code className="font-mono">{pipeline.schema}.{pipeline.table}</code>
        </p>
        {pipeline.last_run_at && (
          <p className="text-xs text-gray-400 mt-0.5">
            Last run: {new Date(pipeline.last_run_at).toLocaleString()}
            {pipeline.last_run_rows != null && ` · ${pipeline.last_run_rows} rows`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 ml-3">
        <button
          onClick={onEdit}
          disabled={running}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Edit
        </button>
        <button
          onClick={onRerun}
          disabled={running}
          className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
        >
          {running ? 'Running…' : 'Re-run'}
        </button>
        <button
          onClick={onDelete}
          disabled={running}
          className="px-2 py-1.5 text-sm text-gray-400 hover:text-red-600"
          title="Delete pipeline"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
