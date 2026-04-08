import React, { useState, useEffect, useCallback } from 'react';
import { dbtApi } from '../../api/client';

function DbtLineage({ connectionId }) {
  const [status, setStatus] = useState(null);
  const [lineage, setLineage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    if (!connectionId) return;
    try {
      setLoading(true);
      const res = await dbtApi.getStatus(connectionId);
      setStatus(res);

      if (res.has_artifacts) {
        const lin = await dbtApi.getLineage(connectionId);
        setLineage(lin);
      } else {
        setLineage(null);
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleGenerate = async () => {
    if (!connectionId) return;
    try {
      setGenerating(true);
      setError(null);
      await dbtApi.generateDocs(connectionId);
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCleanup = async () => {
    if (!connectionId) return;
    try {
      await dbtApi.cleanup(connectionId);
      setLineage(null);
      setStatus(null);
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!connectionId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a connection to view dbt lineage
      </div>
    );
  }

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
        Loading dbt status...
      </div>
    );
  }

  // Group sources by schema
  const sourcesBySchema = {};
  if (lineage?.sources) {
    for (const src of lineage.sources) {
      const schema = src.schema || 'dbo';
      if (!sourcesBySchema[schema]) {
        sourcesBySchema[schema] = [];
      }
      sourcesBySchema[schema].push(src);
    }
  }

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header / Status Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">dbt Documentation</h2>
            {status?.has_artifacts ? (
              <p className="text-sm text-gray-500 mt-1">
                Last generated: {status.catalog?.modified ? new Date(status.catalog.modified).toLocaleString() : 'Unknown'}
                {status.table_count != null && ` | ${status.table_count} tables documented`}
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-1">
                No documentation generated yet for this connection
              </p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {status?.has_artifacts && (
              <button
                onClick={handleCleanup}
                className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
              >
                Clean Up
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`px-4 py-2 text-sm font-medium rounded-md text-white ${
                generating
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {generating ? (
                <span className="flex items-center">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Generating...
                </span>
              ) : status?.has_artifacts ? (
                'Regenerate'
              ) : (
                'Generate dbt Docs'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Generating progress */}
      {generating && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <div>
              <p className="text-sm font-medium text-blue-800">Generating dbt documentation...</p>
              <p className="text-xs text-blue-600 mt-1">
                Discovering schema, creating sources, and running dbt docs generate. This may take a minute.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No artifacts prompt */}
      {!status?.has_artifacts && !generating && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">📖</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Generate dbt Documentation</h3>
          <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
            Click the button above to discover your database schema and generate
            dbt documentation with column-level metadata and lineage information.
          </p>
        </div>
      )}

      {/* Lineage data */}
      {status?.has_artifacts && lineage && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-2xl font-bold text-blue-600">{lineage.source_count || 0}</p>
              <p className="text-sm text-gray-500">Sources Documented</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-2xl font-bold text-green-600">{Object.keys(sourcesBySchema).length}</p>
              <p className="text-sm text-gray-500">Schemas</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-2xl font-bold text-purple-600">
                {lineage.sources?.reduce((sum, s) => sum + Object.keys(s.columns || {}).length, 0) || 0}
              </p>
              <p className="text-sm text-gray-500">Columns</p>
            </div>
          </div>

          {/* Source tables grouped by schema */}
          {Object.entries(sourcesBySchema).sort(([a], [b]) => a.localeCompare(b)).map(([schema, sources]) => (
            <div key={schema} className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                <h3 className="text-sm font-semibold text-gray-700">
                  Schema: {schema}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    ({sources.length} table{sources.length !== 1 ? 's' : ''})
                  </span>
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {sources.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((source) => (
                  <SourceRow key={source.unique_id} source={source} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceRow({ source }) {
  const [expanded, setExpanded] = useState(false);
  const columns = Object.values(source.columns || {});

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
      >
        <div className="flex items-center space-x-3">
          <span className="text-gray-400">{expanded ? '\u25BC' : '\u25B6'}</span>
          <span className="font-medium text-gray-900">{source.name}</span>
          {source.description && (
            <span className="text-sm text-gray-500">- {source.description}</span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {columns.length} column{columns.length !== 1 ? 's' : ''}
        </span>
      </button>

      {expanded && columns.length > 0 && (
        <div className="px-4 pb-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="pb-2 pl-8">Column</th>
                <th className="pb-2">Data Type</th>
                <th className="pb-2">Description</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {columns.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((col) => (
                <tr key={col.name} className="border-t border-gray-50">
                  <td className="py-1.5 pl-8 font-mono text-xs">{col.name}</td>
                  <td className="py-1.5 text-xs text-gray-500">{col.data_type || '-'}</td>
                  <td className="py-1.5 text-xs text-gray-500">{col.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DbtLineage;
