import React, { useState, useEffect, useMemo, useRef } from 'react';
import { localEtlApi } from '../../api/client';

const STEPS = [
  { key: 'source', label: 'Source' },
  { key: 'destination', label: 'Destination' },
  { key: 'review', label: 'Review & Run' },
];

export default function PipelineWizard({
  files, onClose, onComplete, onFilesChanged, onGoToTargets, targetsVersion,
  editingPipeline = null,
}) {
  const isEditing = !!editingPipeline;
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex].key;

  // Source state — pre-fill from the pipeline being edited, otherwise use first file.
  const [sourceFile, setSourceFile] = useState(editingPipeline?.source_file || files[0]?.name || '');
  const [sourceColumns, setSourceColumns] = useState([]);  // [{name, duckdb_type, sql_type, nullable}]
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState(null);

  // Destination state
  const [connections, setConnections] = useState([]);
  const [connectionId, setConnectionId] = useState(editingPipeline?.connection_id || '');
  const [existingTables, setExistingTables] = useState([]);  // [{schema, name}]
  const [destSchema, setDestSchema] = useState(editingPipeline?.schema || 'dbo');
  const [destTable, setDestTable] = useState(editingPipeline?.table || '');
  const [tableExists, setTableExists] = useState(null);  // null | true | false
  const [existingColumns, setExistingColumns] = useState([]);
  const [mode, setMode] = useState(editingPipeline?.mode || '');
  const [upsertKeys, setUpsertKeys] = useState(editingPipeline?.upsert_keys || []);
  const [destChecking, setDestChecking] = useState(false);
  const [destError, setDestError] = useState(null);

  // Review / save / run state
  const [saveAs, setSaveAs] = useState(editingPipeline?.name || '');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState(null);

  // Load source schema whenever the file changes. In edit mode, overlay any
  // SQL types the user customized last time onto the fresh schema so their
  // prior decisions aren't lost (file shape may have drifted since save).
  useEffect(() => {
    if (!sourceFile) return;
    setSourceLoading(true);
    setSourceError(null);
    localEtlApi.getSourceSchema(sourceFile)
      .then((res) => {
        const fresh = res.data.columns;
        if (isEditing && editingPipeline?.columns?.length) {
          const savedTypes = new Map(
            editingPipeline.columns.map((c) => [c.name, c.type])
          );
          setSourceColumns(
            fresh.map((c) =>
              savedTypes.has(c.name) ? { ...c, sql_type: savedTypes.get(c.name) } : c
            )
          );
        } else {
          setSourceColumns(fresh);
        }
      })
      .catch((err) => setSourceError(err.message))
      .finally(() => setSourceLoading(false));
  }, [sourceFile, isEditing, editingPipeline]);

  // In edit mode, automatically inspect the destination table once on mount
  // so the user lands on the destination step with everything already loaded.
  useEffect(() => {
    if (!isEditing || !connectionId || !destTable) return;
    localEtlApi
      .inspectTable(connectionId, destSchema || 'dbo', destTable)
      .then((res) => {
        setTableExists(res.data.exists);
        setExistingColumns(res.data.columns || []);
      })
      .catch(() => {});
    // Mount-only: we want the auto-check to run once when the wizard opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch connections whenever the wizard mounts or the parent signals
  // that a new target was added (via targetsVersion bump).
  useEffect(() => {
    localEtlApi.listConnections()
      .then((res) => setConnections(res.data || []))
      .catch(() => setConnections([]));
  }, [targetsVersion]);

  // Load existing tables whenever connection changes
  useEffect(() => {
    if (!connectionId) {
      setExistingTables([]);
      return;
    }
    localEtlApi.listDestinationTables(connectionId)
      .then((res) => setExistingTables(res.data.tables || []))
      .catch(() => setExistingTables([]));
  }, [connectionId]);

  // Final columns the wizard will send to the backend.
  // For "create" mode: source columns (user can edit types).
  // For existing tables: intersection — destination columns that also exist in source.
  const destinationColumns = useMemo(() => {
    if (tableExists && existingColumns.length) {
      const sourceNames = new Set(sourceColumns.map((c) => c.name));
      return existingColumns
        .filter((c) => sourceNames.has(c.name))
        .map((c) => ({ name: c.name, type: c.type, nullable: c.nullable }));
    }
    return sourceColumns.map((c) => ({
      name: c.name,
      type: c.sql_type,
      nullable: c.nullable !== false,
    }));
  }, [tableExists, existingColumns, sourceColumns]);

  const missingFromSource = useMemo(() => {
    if (!tableExists) return [];
    const sourceNames = new Set(sourceColumns.map((c) => c.name));
    return existingColumns.filter((c) => !sourceNames.has(c.name)).map((c) => c.name);
  }, [tableExists, existingColumns, sourceColumns]);

  const checkTable = async () => {
    if (!connectionId || !destTable.trim()) {
      setDestError('Pick a connection and enter a table name');
      return;
    }
    setDestChecking(true);
    setDestError(null);
    try {
      const res = await localEtlApi.inspectTable(connectionId, destSchema.trim() || 'dbo', destTable.trim());
      setTableExists(res.data.exists);
      setExistingColumns(res.data.columns || []);
      // Auto-pick a sensible default mode but preserve the user's existing
      // pick if it's still applicable (e.g. they had upsert selected).
      if (res.data.exists) {
        setMode((m) => (m === 'truncate_insert' || m === 'upsert' ? m : 'truncate_insert'));
      } else {
        setMode('create');
      }
    } catch (err) {
      setDestError(err.message);
    } finally {
      setDestChecking(false);
    }
  };

  const updateColumnType = (idx, newType) => {
    setSourceColumns((cols) =>
      cols.map((c, i) => (i === idx ? { ...c, sql_type: newType } : c))
    );
  };

  const toggleUpsertKey = (colName) => {
    setUpsertKeys((keys) =>
      keys.includes(colName) ? keys.filter((k) => k !== colName) : [...keys, colName]
    );
  };

  const canAdvanceFromSource = sourceFile && sourceColumns.length > 0 && !sourceError;
  const canAdvanceFromDest =
    connectionId &&
    destTable.trim() &&
    tableExists !== null &&
    mode &&
    (mode !== 'upsert' || upsertKeys.length > 0) &&
    destinationColumns.length > 0;

  // In create mode: POST /pipelines/run (with optional save_as).
  // In edit mode: PUT /pipelines/<id>, then optionally POST /pipelines/<id>/run.
  const runPipeline = async ({ executeAfterSave = true } = {}) => {
    setRunning(true);
    setRunError(null);
    try {
      const payload = {
        source_file: sourceFile,
        connection_id: connectionId,
        schema: destSchema.trim() || 'dbo',
        table: destTable.trim(),
        mode,
        columns: destinationColumns,
        upsert_keys: mode === 'upsert' ? upsertKeys : [],
      };

      if (isEditing) {
        await localEtlApi.updatePipeline(editingPipeline.id, {
          name: saveAs.trim() || editingPipeline.name,
          ...payload,
        });
        if (executeAfterSave) {
          const runRes = await localEtlApi.runSavedPipeline(editingPipeline.id);
          setRunResult(runRes.data);
        } else {
          setRunResult({ saved_only: true });
        }
      } else if (!executeAfterSave) {
        // Create mode, Save Only: definition saved, no execution.
        if (!saveAs.trim()) {
          throw new Error('Pipeline name is required to save.');
        }
        await localEtlApi.createPipeline({ name: saveAs.trim(), ...payload });
        setRunResult({ saved_only: true });
      } else {
        const res = await localEtlApi.runPipeline({
          ...payload,
          save_as: saveAs.trim() || undefined,
        });
        setRunResult(res.data);
      }
      onComplete?.();
    } catch (err) {
      setRunError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {isEditing ? 'Edit Pipeline' : 'New ETL Pipeline'}
            </h2>
            {isEditing && (
              <p className="text-xs text-gray-500 mt-0.5">{editingPipeline.name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            &times;
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 border-b flex items-center gap-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-2 ${i === stepIndex ? 'text-blue-600' : i < stepIndex ? 'text-gray-700' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  i === stepIndex ? 'bg-blue-600 text-white' : i < stepIndex ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {i + 1}
                </div>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {step === 'source' && (
            <SourceStep
              files={files}
              sourceFile={sourceFile}
              setSourceFile={setSourceFile}
              sourceColumns={sourceColumns}
              loading={sourceLoading}
              error={sourceError}
              updateColumnType={updateColumnType}
              onFilesChanged={onFilesChanged}
            />
          )}
          {step === 'destination' && (
            <DestinationStep
              connections={connections}
              connectionId={connectionId}
              setConnectionId={setConnectionId}
              existingTables={existingTables}
              destSchema={destSchema}
              setDestSchema={setDestSchema}
              destTable={destTable}
              setDestTable={setDestTable}
              tableExists={tableExists}
              existingColumns={existingColumns}
              destinationColumns={destinationColumns}
              missingFromSource={missingFromSource}
              mode={mode}
              setMode={setMode}
              upsertKeys={upsertKeys}
              toggleUpsertKey={toggleUpsertKey}
              checkTable={checkTable}
              checking={destChecking}
              error={destError}
              onGoToTargets={onGoToTargets}
            />
          )}
          {step === 'review' && (
            <ReviewStep
              isEditing={isEditing}
              sourceFile={sourceFile}
              sourceRowsCount={sourceColumns.length}
              connection={connections.find((c) => c.id === connectionId)}
              destSchema={destSchema}
              destTable={destTable}
              mode={mode}
              destinationColumns={destinationColumns}
              upsertKeys={upsertKeys}
              saveAs={saveAs}
              setSaveAs={setSaveAs}
              runResult={runResult}
              runError={runError}
              running={running}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50">
          <button
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0 || running}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded"
            >
              {runResult ? 'Done' : 'Cancel'}
            </button>
            {step !== 'review' && (
              <button
                onClick={() => setStepIndex((i) => i + 1)}
                disabled={
                  (step === 'source' && !canAdvanceFromSource) ||
                  (step === 'destination' && !canAdvanceFromDest)
                }
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Next
              </button>
            )}
            {step === 'review' && !runResult && !isEditing && (
              <>
                {saveAs.trim() && (
                  <button
                    onClick={() => runPipeline({ executeAfterSave: false })}
                    disabled={running}
                    className="px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
                  >
                    {running ? 'Saving…' : 'Save Only'}
                  </button>
                )}
                <button
                  onClick={() => runPipeline()}
                  disabled={running}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {running ? 'Running…' : saveAs.trim() ? 'Save & Run' : 'Run Pipeline'}
                </button>
              </>
            )}
            {step === 'review' && !runResult && isEditing && (
              <>
                <button
                  onClick={() => runPipeline({ executeAfterSave: false })}
                  disabled={running}
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
                >
                  {running ? 'Saving…' : 'Save Only'}
                </button>
                <button
                  onClick={() => runPipeline({ executeAfterSave: true })}
                  disabled={running}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {running ? 'Running…' : 'Save & Run'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Step components ----- //

function SourceStep({ files, sourceFile, setSourceFile, sourceColumns, loading, error, updateColumnType, onFilesChanged }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const doUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await localEtlApi.upload(file);
      const uploadedName = res.data?.name || file.name;
      onFilesChanged?.();
      setSourceFile(uploadedName);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const onPicked = (e) => {
    const f = e.target.files?.[0];
    if (f) doUpload(f);
    e.target.value = '';  // allow re-picking the same file
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) doUpload(f);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Choose a flat file</label>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={`cursor-pointer border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.parquet,.json,.jsonl,.xlsx,.xls"
            onChange={onPicked}
            className="hidden"
          />
          {uploading ? (
            <p className="text-sm text-gray-600">Uploading…</p>
          ) : (
            <>
              <p className="text-sm text-gray-700">
                <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">CSV, Parquet, JSON, JSONL, XLSX, XLS · up to 200 MB</p>
            </>
          )}
        </div>
        {uploadError && <p className="text-sm text-red-600 mt-2">{uploadError}</p>}
      </div>

      {files.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            …or pick a file already in storage
          </label>
          <select
            value={sourceFile}
            onChange={(e) => setSourceFile(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">— Pick a file —</option>
            {files.map((f) => (
              <option key={f.name} value={f.name}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Reading schema…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {sourceColumns.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Detected columns ({sourceColumns.length})
          </h3>
          <p className="text-xs text-gray-500 mb-2">
            SQL Server types are inferred from the file. Edit them now if you'll be creating a new destination table.
          </p>
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Column</th>
                  <th className="text-left px-3 py-2">Source type</th>
                  <th className="text-left px-3 py-2">SQL Server type</th>
                </tr>
              </thead>
              <tbody>
                {sourceColumns.map((c, i) => (
                  <tr key={c.name} className="border-t">
                    <td className="px-3 py-1.5 font-mono text-xs">{c.name}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-500">{c.duckdb_type}</td>
                    <td className="px-3 py-1.5">
                      <input
                        value={c.sql_type}
                        onChange={(e) => updateColumnType(i, e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 font-mono text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DestinationStep({
  connections, connectionId, setConnectionId,
  existingTables, destSchema, setDestSchema, destTable, setDestTable,
  tableExists, existingColumns, destinationColumns, missingFromSource,
  mode, setMode, upsertKeys, toggleUpsertKey,
  checkTable, checking, error, onGoToTargets,
}) {
  if (connections.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
        <p className="font-medium">No ETL targets configured yet.</p>
        <p className="mt-1 text-amber-800">
          Targets are SQL Server connections that ETL pipelines write to. Add one in the Targets tab and come back to finish your pipeline.
        </p>
        {onGoToTargets && (
          <button
            onClick={onGoToTargets}
            className="mt-3 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Go to Targets
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">Destination connection</label>
          {onGoToTargets && (
            <button
              type="button"
              onClick={onGoToTargets}
              className="text-xs text-blue-600 hover:underline"
            >
              + Add new target
            </button>
          )}
        </div>
        <select
          value={connectionId}
          onChange={(e) => setConnectionId(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">— Pick a SQL Server connection —</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.server} / {c.database})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Schema</label>
          <input
            value={destSchema}
            onChange={(e) => setDestSchema(e.target.value)}
            placeholder="dbo"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Table name</label>
          <input
            value={destTable}
            onChange={(e) => setDestTable(e.target.value)}
            placeholder="customers"
            list="existing-tables"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
          />
          <datalist id="existing-tables">
            {existingTables
              .filter((t) => t.schema === (destSchema || 'dbo'))
              .map((t) => <option key={`${t.schema}.${t.name}`} value={t.name} />)}
          </datalist>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={checkTable}
          disabled={checking || !connectionId || !destTable.trim()}
          className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Check table'}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {tableExists === false && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
          <p className="font-medium text-amber-900">Table doesn't exist — it will be created.</p>
          <p className="text-amber-800 mt-1">
            We'll run <code className="bg-amber-100 px-1 rounded">CREATE TABLE {destSchema || 'dbo'}.{destTable}</code> using
            the column types you set on the Source step.
          </p>
          <p className="text-amber-800 mt-1">
            Two lineage columns will be added automatically:{' '}
            <code className="bg-amber-100 px-1 rounded">_source_name</code> and{' '}
            <code className="bg-amber-100 px-1 rounded">_loaded_at</code>.
          </p>
        </div>
      )}

      {tableExists === true && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
            <p className="font-medium text-green-900">Table exists ({existingColumns.length} columns).</p>
            {missingFromSource.length > 0 && (
              <p className="text-amber-800 mt-1">
                Source is missing these destination columns (they'll be NULL):{' '}
                <span className="font-mono text-xs">{missingFromSource.join(', ')}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Load mode</label>
            <div className="space-y-2">
              <label className="flex items-start gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="mode"
                  value="truncate_insert"
                  checked={mode === 'truncate_insert'}
                  onChange={(e) => setMode(e.target.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium text-sm">Truncate & Insert</div>
                  <div className="text-xs text-gray-500">Empty the table, then load every row from the source.</div>
                </div>
              </label>
              <label className="flex items-start gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="mode"
                  value="upsert"
                  checked={mode === 'upsert'}
                  onChange={(e) => setMode(e.target.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium text-sm">Upsert (MERGE on key)</div>
                  <div className="text-xs text-gray-500">Update rows that match the key column(s), insert the rest.</div>
                </div>
              </label>
            </div>
          </div>

          {mode === 'upsert' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upsert key column(s)</label>
              <p className="text-xs text-gray-500 mb-2">
                Pick the column(s) that uniquely identify a row.
              </p>
              <div className="flex flex-wrap gap-2">
                {destinationColumns.map((c) => (
                  <label
                    key={c.name}
                    className={`px-2 py-1 text-xs rounded border cursor-pointer ${
                      upsertKeys.includes(c.name)
                        ? 'bg-blue-100 border-blue-400 text-blue-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={upsertKeys.includes(c.name)}
                      onChange={() => toggleUpsertKey(c.name)}
                      className="hidden"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewStep({
  isEditing, sourceFile, connection, destSchema, destTable, mode,
  destinationColumns, upsertKeys, saveAs, setSaveAs,
  runResult, runError, running,
}) {
  const modeLabel = {
    create: 'Create new table',
    truncate_insert: 'Truncate & Insert',
    upsert: 'Upsert (MERGE)',
  }[mode] || mode;

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded border p-4 space-y-2 text-sm">
        <Row label="Source file" value={<code className="font-mono">{sourceFile}</code>} />
        <Row
          label="Destination"
          value={
            <span>
              <code className="font-mono">{destSchema || 'dbo'}.{destTable}</code>
              {connection && <span className="text-gray-500 ml-2">on {connection.name}</span>}
            </span>
          }
        />
        <Row label="Mode" value={modeLabel} />
        <Row label="Columns" value={`${destinationColumns.length} mapped`} />
        {mode === 'upsert' && (
          <Row label="Upsert keys" value={<code className="font-mono">{upsertKeys.join(', ')}</code>} />
        )}
      </div>

      {!runResult && !running && (
        <div className="border border-blue-200 bg-blue-50 rounded p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-blue-900 mb-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            {isEditing ? 'Pipeline name' : 'Save this pipeline for re-execution'}
          </label>
          <input
            value={saveAs}
            onChange={(e) => setSaveAs(e.target.value)}
            placeholder="e.g. Daily customers load"
            className="w-full border border-blue-300 rounded px-3 py-2 text-sm bg-white"
          />
          <p className="text-xs text-blue-800 mt-1">
            {isEditing
              ? 'Use Save Only to update the definition, or Save & Run to update and execute.'
              : 'Leave blank for a one-off run. Named pipelines appear in the Saved list and can be re-run anytime.'}
          </p>
        </div>
      )}

      {running && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
          Running pipeline…
        </div>
      )}

      {runError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          {runError}
        </div>
      )}

      {runResult && runResult.saved_only && (
        <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
          <p className="font-medium">Pipeline definition saved.</p>
          <p className="mt-1">Use Re-run from the Saved list to execute it.</p>
        </div>
      )}

      {runResult && !runResult.saved_only && (
        <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
          <p className="font-medium">Loaded {runResult.rows_loaded} rows in {runResult.duration_ms} ms.</p>
          {runResult.saved_pipeline_id && (
            <p className="mt-1">Pipeline saved.</p>
          )}
          {isEditing && (
            <p className="mt-1">Definition updated.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="w-32 text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="flex-1">{value}</div>
    </div>
  );
}
