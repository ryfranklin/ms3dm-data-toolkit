import React, { useState, useEffect } from 'react';
import { configApi } from '../../api/client';

function ConfigManager() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [testingConnection, setTestingConnection] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    server: '',
    port: '1433',
    database: '',
    auth_type: 'sql_auth',
    username: 'sa',
    password: '',
    description: '',
  });

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const data = await configApi.getConnections();
      setConnections(data.connections || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingConnection) {
        await configApi.updateConnection(editingConnection.id, formData);
      } else {
        await configApi.createConnection(formData);
      }
      setShowForm(false);
      setEditingConnection(null);
      resetForm();
      loadConnections();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (connection) => {
    setEditingConnection(connection);
    setFormData({
      name: connection.name || '',
      server: connection.server || '',
      port: connection.port || '1433',
      database: connection.database || '',
      auth_type: connection.auth_type || 'sql_auth',
      username: connection.username || 'sa',
      password: connection.password || '',
      description: connection.description || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) {
      return;
    }
    try {
      await configApi.deleteConnection(id);
      loadConnections();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTest = async (id) => {
    try {
      setTestingConnection(id);
      setTestResult(null);
      const result = await configApi.testConnection(id);
      setTestResult({ connectionId: id, success: true, message: result.message });
    } catch (err) {
      setTestResult({ connectionId: id, success: false, message: err.message });
    } finally {
      setTestingConnection(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      server: '',
      port: '1433',
      database: '',
      auth_type: 'sql_auth',
      username: 'sa',
      password: '',
      description: '',
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingConnection(null);
    resetForm();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading connections...</div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Connection Manager</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage SQL Server database connections
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Add Connection
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {showForm && (
        <div className="mt-6 bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {editingConnection ? 'Edit Connection' : 'Add New Connection'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Connection Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Server *
                </label>
                <input
                  type="text"
                  name="server"
                  value={formData.server}
                  onChange={handleInputChange}
                  required
                  placeholder="localhost or server-name"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Port
                </label>
                <input
                  type="text"
                  name="port"
                  value={formData.port}
                  onChange={handleInputChange}
                  placeholder="1433"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Database *
                </label>
                <input
                  type="text"
                  name="database"
                  value={formData.database}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Authentication Type *
                </label>
                <select
                  name="auth_type"
                  value={formData.auth_type}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                >
                  <option value="sql_auth">SQL Server Authentication</option>
                  <option value="windows">Windows Authentication</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {formData.auth_type === 'windows' 
                    ? '🔐 Uses Windows credentials (Trusted Connection). Backend must run on Windows with domain access.'
                    : '🔑 Uses SQL Server username and password.'}
                </p>
              </div>

              {formData.auth_type === 'sql_auth' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Username *
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required={formData.auth_type === 'sql_auth'}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Password *
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required={formData.auth_type === 'sql_auth'}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <div className="rounded-md bg-blue-50 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm text-blue-700">
                          <strong>Windows Authentication</strong> will use the credentials of the user running the backend application. 
                          Ensure the backend is running on Windows and the user has appropriate SQL Server permissions.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={2}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {editingConnection ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-8 flow-root">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      Name
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Server
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Database
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Auth Type
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Description
                    </th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {connections.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">
                        No connections configured. Click "Add Connection" to get started.
                      </td>
                    </tr>
                  ) : (
                    connections.map((connection) => (
                      <tr key={connection.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {connection.name}
                          {connection.is_sample && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                              Sample
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {connection.server}
                          {connection.port && connection.port !== '1433' && `:${connection.port}`}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {connection.database}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          {connection.auth_type === 'windows' ? (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                              🔐 Windows
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                              🔑 SQL Auth
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {connection.description || '-'}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => handleTest(connection.id)}
                            disabled={testingConnection === connection.id}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            {testingConnection === connection.id ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            onClick={() => handleEdit(connection)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(connection.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {testResult && (
        <div className={`mt-4 rounded-md p-4 ${testResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
            {testResult.message}
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfigManager;
