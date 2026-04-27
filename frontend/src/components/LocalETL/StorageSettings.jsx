import React, { useState } from 'react';
import { localEtlApi } from '../../api/client';
import DirectoryBrowser from './DirectoryBrowser';

export default function StorageSettings({ currentPath, onSave, onClose }) {
  const [path, setPath] = useState(currentPath);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showBrowser, setShowBrowser] = useState(false);

  const handleSave = async () => {
    if (!path.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await localEtlApi.updateSettings(path.trim());
      onSave(path.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBrowseSelect = (selectedPath) => {
    setPath(selectedPath);
    setShowBrowser(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Storage Settings</h3>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Storage Directory
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="flex-1 rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2"
                placeholder="./local_storage"
              />
              <button
                onClick={() => setShowBrowser(true)}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
              >
                Browse
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Directory where local data files will be stored and queried.
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-gray-50 rounded-b-lg flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !path.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {showBrowser && (
        <DirectoryBrowser
          initialPath={path || '/'}
          onSelect={handleBrowseSelect}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </div>
  );
}
