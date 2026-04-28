import React, { useState } from 'react';
import { setupApi } from '../../api/client';

/**
 * First-run setup screen shown when /api/setup/status reports needs_setup.
 * Collects SQL Server credentials for the metadata database (where the app
 * stores connections, pipelines, run history, etc.) and persists them to
 * the user's local config file.
 */
export default function SetupScreen({ onConfigured }) {
  // Default DB name. KEEP IN SYNC with backend `services/app_config.py`
  // `DEFAULT_DATABASE_NAME` — the field is editable, this is just the suggestion.
  const [form, setForm] = useState({
    host: '',
    port: 1433,
    user: 'sa',
    password: '',
    database: 'DataToolkit',
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const res = await setupApi.testConnection(form);
      setTestResult({
        ok: true,
        message: res.data?.message || 'Connection successful',
      });
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await setupApi.configure(form);
      onConfigured?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-lg shadow w-full max-w-xl">
        <div className="px-6 py-5 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Welcome to MS3DM Workbench</h1>
          <p className="text-sm text-gray-500 mt-1">
            First-run setup. Enter the SQL Server where the app should store its metadata
            (connections, pipelines, run history). The database will be created automatically
            if it doesn't exist.
          </p>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Server</label>
              <input
                type="text"
                value={form.host}
                onChange={(e) => update('host', e.target.value)}
                placeholder="hostname\\instance or hostname"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Port</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => update('port', Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={form.user}
                onChange={(e) => update('user', e.target.value)}
                required
                autoComplete="off"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Metadata database name</label>
            <input
              type="text"
              value={form.database}
              onChange={(e) => update('database', e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Defaults to <code className="bg-gray-100 px-1 rounded">DataToolkit</code>.
              You can change this to any name; it'll be created on the server above
              if it doesn't already exist.
            </p>
          </div>

          {testResult && (
            <div
              className={`text-sm rounded p-2 border ${
                testResult.ok
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {testResult.message}
            </div>
          )}

          {error && (
            <div className="text-sm rounded p-2 border bg-red-50 border-red-200 text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || saving || !form.host || !form.user || !form.password}
              className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            <button
              type="submit"
              disabled={saving || testing}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & Continue'}
            </button>
          </div>
        </form>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 rounded-b-lg">
          The credentials are stored locally in your user config directory. Your password
          is never sent anywhere except this server.
        </div>
      </div>
    </div>
  );
}
