import React, { useState, useEffect, useCallback } from 'react';
import { configApi } from '../../api/client';

const EMPTY_FORM = {
  name: '',
  server: 'sqlserver',
  port: 1433,
  database: '',
  auth_type: 'sql_auth',
  username: 'sa',
  password: '',
  description: '',
};

export default function TargetsPanel({ onTargetsChanged }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [testing, setTesting] = useState(null);  // id being tested
  const [testResult, setTestResult] = useState(null);  // {id, success, message}

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await configApi.getConnections();
      setConnections(res.connections || []);
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await configApi.createConnection(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await fetchConnections();
      onTargetsChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (conn) => {
    if (!window.confirm(`Delete target "${conn.name}"? This only removes it from the toolkit; the SQL Server itself is untouched.`)) return;
    try {
      await configApi.deleteConnection(conn.id);
      await fetchConnections();
      onTargetsChanged?.();
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleTest = async (conn) => {
    setTesting(conn.id);
    setTestResult(null);
    try {
      const res = await configApi.testConnection(conn.id);
      const success = res.success ?? res.data?.success ?? true;
      const message = res.message || res.data?.message || (success ? 'Connection successful' : 'Connection failed');
      setTestResult({ id: conn.id, success, message });
    } catch (err) {
      setTestResult({ id: conn.id, success: false, message: err.message });
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">ETL Targets</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            SQL Server connections that ETL pipelines can write to.
          </p>
        </div>
        <button
          onClick={() => { setShowForm((s) => !s); setError(null); }}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ New Target'}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-900">New SQL Server target</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Display name" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. Local AdventureWorks"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Database" required>
                <input
                  value={form.database}
                  onChange={(e) => setForm({ ...form, database: e.target.value })}
                  required
                  placeholder="e.g. AdventureWorksLT2022"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                />
              </Field>
              <Field label="Server" required>
                <input
                  value={form.server}
                  onChange={(e) => setForm({ ...form, server: e.target.value })}
                  required
                  placeholder="sqlserver / localhost / host.docker.internal"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                />
              </Field>
              <Field label="Port">
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                />
              </Field>
              <Field label="Auth type">
                <select
                  value={form.auth_type}
                  onChange={(e) => setForm({ ...form, auth_type: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="sql_auth">SQL Authentication</option>
                  <option value="windows">Windows Authentication</option>
                </select>
              </Field>
              {form.auth_type === 'sql_auth' && (
                <>
                  <Field label="Username" required>
                    <input
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      required
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                    />
                  </Field>
                  <Field label="Password" required>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                    />
                  </Field>
                </>
              )}
            </div>
            <Field label="Description (optional)">
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </Field>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">{error}</div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); }}
                className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save target'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading targets…</p>
        ) : connections.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <h3 className="text-sm font-medium text-gray-900">No targets configured</h3>
            <p className="text-xs text-gray-500 mt-1">
              Add a SQL Server connection so ETL pipelines have a place to write to.
            </p>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Add your first target
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((c) => (
              <div key={c.id} className="bg-white border border-gray-200 rounded p-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-gray-900 truncate">{c.name}</h3>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded font-mono">
                      {c.auth_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate font-mono">
                    {c.server}:{c.port || 1433} / {c.database}
                  </p>
                  {testResult && testResult.id === c.id && (
                    <p className={`text-xs mt-1 ${testResult.success ? 'text-green-700' : 'text-red-600'}`}>
                      {testResult.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={() => handleTest(c)}
                    disabled={testing === c.id}
                    className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
                  >
                    {testing === c.id ? 'Testing…' : 'Test'}
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="px-2 py-1.5 text-sm text-gray-400 hover:text-red-600"
                    title="Delete target"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
