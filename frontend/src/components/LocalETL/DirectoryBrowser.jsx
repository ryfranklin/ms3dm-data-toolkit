import React, { useState, useEffect } from 'react';
import { localEtlApi } from '../../api/client';

export default function DirectoryBrowser({ initialPath, onSelect, onClose }) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState([]);
  const [parentPath, setParentPath] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await localEtlApi.browse(currentPath);
        if (!cancelled) {
          setEntries(res.data.entries);
          setParentPath(res.data.parent);
          setCurrentPath(res.data.path);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentPath]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900">Browse Directories</h4>
          <p className="text-xs text-gray-500 font-mono mt-1 truncate">{currentPath}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-gray-500">Loading...</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-600">{error}</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {parentPath && (
                <li>
                  <button
                    onClick={() => setCurrentPath(parentPath)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                    </svg>
                    ..
                  </button>
                </li>
              )}
              {entries.map((entry) => (
                <li key={entry.name}>
                  <button
                    onClick={() => setCurrentPath(`${currentPath}/${entry.name}`)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                    {entry.name}
                  </button>
                </li>
              ))}
              {entries.length === 0 && !parentPath && (
                <li className="px-4 py-3 text-sm text-gray-400">Empty directory</li>
              )}
            </ul>
          )}
        </div>

        <div className="px-4 py-3 bg-gray-50 rounded-b-lg flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(currentPath)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Select This Directory
          </button>
        </div>
      </div>
    </div>
  );
}
