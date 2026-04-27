import React, { useState, useRef, useCallback } from 'react';
import { localEtlApi } from '../../api/client';
import { formatSize, joinPath, viewName } from '../../lib/etlUtils';

const FILE_ICONS = {
  csv: '📊',
  parquet: '📦',
  json: '📋',
  jsonl: '📋',
  xlsx: '📗',
  xls: '📗',
};

export default function FileManager({
  files,
  loading,
  storagePath,
  selectedFile,
  onSelectFile,
  onFileUploaded,
  onFileDeleted,
  onInsertTable,
}) {
  // Schema panel state — describes whichever file/view is currently selected.
  const [schema, setSchema] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaContext, setSchemaContext] = useState(null);  // { kind: 'file' | 'local_view', name, viewName? }
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dbExpanded, setDbExpanded] = useState(true);
  const fileInputRef = useRef(null);

  const loadFileSchema = async (filename, context) => {
    onSelectFile(filename);
    setSchemaContext(context);
    setSchemaLoading(true);
    try {
      const res = await localEtlApi.getSchema(filename);
      setSchema({
        columns: (res.data.columns || []).map((c) => ({
          name: c.column_name,
          type: c.column_type,
        })),
      });
    } catch {
      setSchema(null);
    } finally {
      setSchemaLoading(false);
    }
  };

  const handleSelectFile = useCallback(
    (filename) => loadFileSchema(filename, { kind: 'file', name: filename }),
    // loadFileSchema closes over onSelectFile only; safe to depend on that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSelectFile]
  );

  const handleSelectLocalView = (filename, vName) =>
    loadFileSchema(filename, { kind: 'local_view', name: filename, viewName: vName });

  const handleUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const file of fileList) {
        await localEtlApi.upload(file);
      }
      onFileUploaded();
    } catch {
      // Error handling done by caller
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename, e) => {
    e.stopPropagation();
    if (!confirm(`Delete ${filename}?`)) return;
    try {
      await localEtlApi.deleteFile(filename);
      onFileDeleted(filename);
      if (schemaContext && schemaContext.name === filename) {
        setSchema(null);
        setSchemaContext(null);
      }
    } catch {
      // silent
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const fileTableName = schemaContext
    ? schemaContext.viewName || viewName(schemaContext.name)
    : null;

  return (
    <div
      className="w-72 border-r border-gray-200 bg-gray-50 flex flex-col overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-blue-50 bg-opacity-90 border-2 border-dashed border-blue-400 rounded flex items-center justify-center z-10 pointer-events-none">
          <span className="text-blue-600 font-medium">Drop files here</span>
        </div>
      )}

      {/* Files section */}
      <div className="flex flex-col overflow-hidden" style={{ flex: '1 1 0' }}>
        <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Files</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.parquet,.json,.jsonl,.xlsx,.xls"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-xs text-gray-400">Loading files...</div>
          ) : files.length === 0 ? (
            <div className="p-3 text-xs text-gray-400">
              No data files found. Upload CSV, Parquet, JSON, or Excel files.
            </div>
          ) : (
            <ul className="py-1">
              {files.map((f) => {
                const fullPath = joinPath(storagePath, f.name);
                const isSelected = selectedFile === f.name && schemaContext?.kind === 'file';
                return (
                  <li key={f.name}>
                    <button
                      onClick={() => handleSelectFile(f.name)}
                      className={`w-full px-3 py-1.5 text-left text-sm flex items-start gap-2 group ${
                        isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="mt-0.5">{FILE_ICONS[f.type] || '📄'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-xs font-medium">{f.name}</div>
                        <div className="text-[10px] text-gray-400 truncate font-mono" title={fullPath}>
                          {fullPath}
                        </div>
                        <div className="text-[10px] text-gray-400">{formatSize(f.size)}</div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(f.name, e)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-0.5"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Local DuckDB section — appears once files are loaded; shows the
          SQL-friendly view names that the workbench can SELECT against. */}
      {files.length > 0 && (
        <div className="border-t border-gray-200 flex flex-col" style={{ maxHeight: '40%' }}>
          <button
            onClick={() => setDbExpanded((v) => !v)}
            className="px-3 py-2 border-b border-gray-200 flex items-center gap-2 text-left hover:bg-gray-100"
          >
            <svg
              className={`w-3 h-3 text-gray-400 transition-transform ${dbExpanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>🦆</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Local DuckDB</div>
              <div className="text-[10px] text-gray-400 font-mono">
                in-memory · {files.length} view{files.length !== 1 ? 's' : ''}
              </div>
            </div>
          </button>
          {dbExpanded && (
            <div className="flex-1 overflow-y-auto pb-1">
              <ul className="py-1">
                {files.map((f) => {
                  const vName = viewName(f.name);
                  const isSelected = schemaContext?.kind === 'local_view' && schemaContext.name === f.name;
                  return (
                    <li key={f.name}>
                      <button
                        onClick={() => handleSelectLocalView(f.name, vName)}
                        className={`w-full px-3 py-1 text-left text-xs flex items-center gap-1.5 group ${
                          isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        <span className="text-gray-400">▸</span>
                        <span className="font-mono truncate flex-1">{vName}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onInsertTable(vName); }}
                          className="opacity-0 group-hover:opacity-100 text-[9px] px-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-600"
                          title={`Insert SELECT * FROM ${vName}`}
                        >
                          INSERT
                        </button>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Schema panel — bottom; shows whichever file/view is selected. */}
      {schemaContext && (
        <div className="border-t border-gray-200 max-h-[40%] overflow-y-auto">
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Schema</div>
              <div className="text-[10px] text-gray-400 truncate font-mono">
                {schemaContext.kind === 'local_view'
                  ? `view · ${schemaContext.viewName}`
                  : schemaContext.name}
              </div>
            </div>
            {fileTableName && (
              <button
                onClick={() => onInsertTable(fileTableName)}
                className="text-[10px] px-1.5 py-0.5 bg-gray-200 hover:bg-gray-300 rounded text-gray-600 ml-2 shrink-0"
                title={`Insert SELECT * FROM ${fileTableName}`}
              >
                INSERT
              </button>
            )}
          </div>
          {schemaLoading ? (
            <div className="px-3 pb-2 text-xs text-gray-400">Loading schema...</div>
          ) : schema?.columns?.length ? (
            <ul className="px-3 pb-2 space-y-0.5">
              {schema.columns.map((col) => (
                <li key={col.name} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-700 font-mono truncate flex-1">{col.name}</span>
                  <span className="text-gray-400 text-[10px] uppercase">{col.type}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 pb-2 text-xs text-gray-400">Unable to read schema</div>
          )}
        </div>
      )}
    </div>
  );
}
