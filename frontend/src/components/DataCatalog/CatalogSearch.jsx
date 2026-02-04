import React, { useState } from 'react';
import axios from 'axios';

function CatalogSearch({ connectionId, onTableSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('http://localhost:8000/api/catalog/search', {
        connection_id: connectionId,
        query: query.trim()
      });
      setResults(response.data);
    } catch (err) {
      console.error('Error searching catalog:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalResults = (results?.tables?.length || 0) + (results?.columns?.length || 0);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Search Form */}
      <div className="border-b border-gray-200 px-6 py-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Search Database Catalog
        </h2>
        <form onSubmit={handleSearch} className="flex space-x-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tables, columns, schemas..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? '🔄 Searching...' : '🔍 Search'}
          </button>
        </form>
        
        {results && (
          <p className="mt-3 text-sm text-gray-600">
            Found <span className="font-semibold">{totalResults}</span> results for "{query}"
          </p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Error searching</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && !results && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900">Search the catalog</h3>
            <p className="text-sm text-gray-600 mt-2">
              Find tables and columns by name or description
            </p>
          </div>
        )}

        {!loading && results && totalResults === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🤷</div>
            <h3 className="text-lg font-medium text-gray-900">No results found</h3>
            <p className="text-sm text-gray-600 mt-2">
              Try a different search term
            </p>
          </div>
        )}

        {results && (
          <div className="space-y-6">
            {/* Tables */}
            {results.tables && results.tables.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  Tables ({results.tables.length})
                </h3>
                <div className="space-y-2">
                  {results.tables.map((table, idx) => (
                    <button
                      key={idx}
                      onClick={() => onTableSelect(table.schema, table.name)}
                      className="w-full bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">
                            {table.type === 'BASE TABLE' ? '📊' : '👁️'}
                          </span>
                          <div>
                            <p className="font-mono text-gray-900 font-medium">
                              {table.schema}.{table.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {table.type === 'BASE TABLE' ? 'Table' : 'View'}
                            </p>
                          </div>
                        </div>
                        <span className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          →
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Columns */}
            {results.columns && results.columns.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  Columns ({results.columns.length})
                </h3>
                <div className="space-y-2">
                  {results.columns.map((column, idx) => (
                    <button
                      key={idx}
                      onClick={() => onTableSelect(column.schema, column.table)}
                      className="w-full bg-white border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:bg-green-50 transition-colors text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">📋</span>
                          <div>
                            <p className="font-mono text-gray-900">
                              <span className="font-medium text-green-600">{column.column}</span>
                              <span className="text-gray-400 mx-2">in</span>
                              <span className="text-gray-700">{column.schema}.{column.table}</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-1 font-mono">
                              {column.data_type}
                            </p>
                          </div>
                        </div>
                        <span className="text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          →
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CatalogSearch;
