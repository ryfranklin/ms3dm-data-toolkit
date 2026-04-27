import React, { useEffect, useRef, useState } from 'react';
import { localEtlApi } from '../../api/client';
import { formatDuration } from '../../lib/etlUtils';

/**
 * Polls /api/local-etl/pipeline-runs/<runId> every `intervalMs` while the
 * run is in-flight. Fires `onFinished` exactly once when the run reaches
 * a terminal state. Stops on unmount.
 *
 * Returns the latest run object: `{ phase, current, total, status, ... }`
 * or `null` until the first poll completes.
 */
export function usePipelineRun(runId, { intervalMs = 1000, onFinished } = {}) {
  const [run, setRun] = useState(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!runId) return undefined;
    finishedRef.current = false;
    let active = true;
    let timeoutId;

    const poll = async () => {
      try {
        const res = await localEtlApi.getPipelineRun(runId);
        if (!active) return;
        const data = res.data;
        setRun(data);
        const isTerminal = data.status === 'success' || data.status === 'error';
        if (isTerminal) {
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinished?.(data);
          }
          return;
        }
        timeoutId = setTimeout(poll, intervalMs);
      } catch (err) {
        if (!active) return;
        setRun({ status: 'error', error: err.message, phase: 'done' });
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinished?.({ status: 'error', error: err.message });
        }
      }
    };

    poll();
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
    // intervalMs and onFinished are stable from caller's perspective.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return run;
}

const PHASE_LABELS = {
  queued: 'Queued',
  reading: 'Reading source file',
  creating_table: 'Creating destination table',
  truncating: 'Truncating destination',
  inserting: 'Inserting rows',
  staging: 'Staging rows for upsert',
  merging: 'Merging into destination',
  done: 'Complete',
};

/**
 * Stateless progress bar — renders the latest poll result. Pair with
 * `usePipelineRun` for the polling side.
 */
export default function RunProgress({ run }) {
  if (!run) {
    return (
      <div className="text-sm text-gray-500">Starting…</div>
    );
  }

  const {
    phase = 'queued', current = 0, total = 0,
    status, rows_loaded, duration_ms, error, destination,
  } = run;
  const isError = status === 'error';
  const isSuccess = status === 'success';
  const isFinal = isError || isSuccess;
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const phaseLabel = PHASE_LABELS[phase] || phase;
  const barColor = isError ? 'bg-red-500' : isSuccess ? 'bg-green-500' : 'bg-blue-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-800">{phaseLabel}</span>
        {total > 0 && (
          <span className="text-xs text-gray-500 font-mono">
            {current.toLocaleString()} / {total.toLocaleString()}
            {pct > 0 && ` · ${pct.toFixed(0)}%`}
          </span>
        )}
      </div>

      <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
        <div
          className={`h-2 rounded transition-all ${barColor}`}
          style={{ width: total > 0 ? `${pct}%` : isFinal ? '100%' : '8%' }}
        />
      </div>

      {isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded p-2 text-sm text-green-800">
          Loaded {rows_loaded?.toLocaleString?.() ?? rows_loaded} row{rows_loaded === 1 ? '' : 's'}
          {destination && <> into <code className="font-mono">{destination}</code></>}
          {duration_ms != null && <> in {formatDuration(duration_ms)}</>}.
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
          {error || 'Pipeline run failed.'}
        </div>
      )}
    </div>
  );
}
