import axios from 'axios';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

// Configuration API
export const configApi = {
  getConnections: () => apiClient.get('/api/config/'),
  getConnection: (id) => apiClient.get(`/api/config/${id}`),
  createConnection: (data) => apiClient.post('/api/config/', data),
  updateConnection: (id, data) => apiClient.put(`/api/config/${id}`, data),
  deleteConnection: (id) => apiClient.delete(`/api/config/${id}`),
  testConnection: (id) => apiClient.post(`/api/config/${id}/test`),
};

// Quality API
export const qualityApi = {
  runChecks: (data) => apiClient.post('/api/quality/run-checks', data),
  getResults: (checkId) => apiClient.get(`/api/quality/results/${checkId}`),
  getHistory: () => apiClient.get('/api/quality/history'),
  configure: (data) => apiClient.post('/api/quality/configure', data),
  generateConfig: (connectionId) => apiClient.get(`/api/quality/generate-config/${connectionId}`),
  saveConfig: (connectionId, config) => apiClient.post('/api/quality/save-config', { connection_id: connectionId, config }),
  loadConfig: (connectionId) => apiClient.get(`/api/quality/load-config/${connectionId}`),
};

// Documentation API
export const docsApi = {
  getDocuments: () => apiClient.get('/api/docs/'),
  getDocument: (id) => apiClient.get(`/api/docs/${id}`),
  createDocument: (data) => apiClient.post('/api/docs/', data),
  updateDocument: (id, data) => apiClient.put(`/api/docs/${id}`, data),
  deleteDocument: (id) => apiClient.delete(`/api/docs/${id}`),
  getCategories: () => apiClient.get('/api/docs/categories'),
};

// Expectations API (Quality Builder)
export const expectationsApi = {
  getLibrary: () => apiClient.get('/api/expectations/library'),
  validateExpectation: (data) => apiClient.post('/api/expectations/validate', data),
  runAdhoc: (data) => apiClient.post('/api/expectations/run-adhoc', data),
  getResults: () => apiClient.get('/api/expectations/results'),
  getResult: (resultId) => apiClient.get(`/api/expectations/results/${resultId}`),
  getTableSchema: (data) => apiClient.post('/api/expectations/table-schema', data),
  getAvailableTables: (data) => apiClient.post('/api/expectations/available-tables', data),
  getConnections: () => configApi.getConnections(),
  listSuites: () => apiClient.get('/api/expectations/suites'),
};

// Scheduler API (Dagu Integration)
const daguClient = axios.create({
  baseURL: 'http://localhost:8080',
  timeout: 30000,
});

// Dagu response interceptor
daguClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Scheduler error';
    return Promise.reject(new Error(message));
  }
);

export const schedulerApi = {
  // List all DAGs
  listDags: async () => {
    try {
      const response = await daguClient.get('/api/v2/dags');
      
      // Parse Dagu v2 API response
      if (response.dags && Array.isArray(response.dags)) {
        return response.dags.map(item => ({
          id: item.dag?.name || item.fileName,
          name: item.dag?.name || item.fileName,
          description: item.dag?.description || '',
          schedule: item.dag?.schedule?.[0]?.expression || '',
          tags: item.dag?.tags || [],
          steps: item.dag?.steps?.length || 0,
          status: item.latestDAGRun?.statusLabel || 'not_started',
          lastRun: item.latestDAGRun?.startedAt || null,
          nextRun: null, // Dagu doesn't provide next run time in this API
          duration: null,
          suspended: item.suspended || false,
        }));
      }
      
      return [];
    } catch (err) {
      console.error('Error listing DAGs:', err);
      return [];
    }
  },

  // Get specific DAG details
  getDag: (dagId) => daguClient.get(`/api/v2/dags/${dagId}`),

  // Trigger a DAG run (via backend proxy to avoid Dagu API issues)
  triggerDag: (dagId) => apiClient.post(`/api/scheduler/dags/${dagId}/trigger`),

  // Stop a running DAG
  stopDag: (dagId) => daguClient.post(`/api/v2/dags/${dagId}/stop`),

  // Get execution history
  getExecutions: async () => {
    try {
      // Dagu stores execution logs - we'll parse the status from DAG details
      const dags = await schedulerApi.listDags();
      const executions = [];
      
      for (const dag of dags) {
        if (dag.Status && dag.Status.Status) {
          executions.push({
            id: `${dag.Name}_${Date.now()}`,
            dagId: dag.Name,
            dagName: dag.Name,
            status: dag.Status.Status === 0 ? 'success' : dag.Status.Status === 1 ? 'running' : 'failed',
            startTime: dag.Status.StartedAt || new Date().toISOString(),
            duration: Math.floor((new Date() - new Date(dag.Status.StartedAt)) / 1000),
            steps: dag.Steps?.length || 0,
          });
        }
      }
      
      return executions;
    } catch (err) {
      console.error('Error getting executions:', err);
      return [];
    }
  },

  // Get logs for a specific execution
  getLogs: async (dagId, executionId) => {
    try {
      // Dagu v2 API - get latest run logs
      const response = await daguClient.get(`/api/v2/dags/${dagId}`);
      
      // Extract log content from the response
      if (response.latestDAGRun && response.latestDAGRun.log) {
        return { content: response.latestDAGRun.log };
      }
      
      return { content: 'No logs available for this execution' };
    } catch (err) {
      return { error: 'Failed to fetch logs: ' + err.message };
    }
  },

  // Create a new DAG (writes to dags directory via backend)
  createDag: async (yamlContent) => {
    try {
      // Use our backend to write the DAG file
      return await apiClient.post('/api/scheduler/create-dag', { yaml: yamlContent });
    } catch (err) {
      throw new Error('Failed to create pipeline: ' + err.message);
    }
  },

  // Delete a DAG
  deleteDag: (dagId) => apiClient.delete(`/api/scheduler/dags/${dagId}`),
};

// Catalog API
export const catalogApi = {
  discover: (connectionId) => apiClient.post('/api/catalog/discover', { connection_id: connectionId }),
  getTableDetails: (connectionId, schema, table) => 
    apiClient.get(`/api/catalog/table/${schema}/${table}`, { params: { connection_id: connectionId, schema, table } }),
  updateTableMetadata: (connectionId, schema, table, metadata) =>
    apiClient.post(`/api/catalog/table/${schema}/${table}/metadata`, metadata, { params: { connection_id: connectionId, schema, table } }),
  search: (connectionId, query) => apiClient.post('/api/catalog/search', { connection_id: connectionId, query }),
  getSampleData: (connectionId, schema, table, limit = 10) =>
    apiClient.get(`/api/catalog/sample-data/${schema}/${table}`, { params: { connection_id: connectionId, schema, table, limit } }),
};

// Storage API
export const storageApi = {
  getStatus: () => apiClient.get('/api/storage/status'),
  getCleanupInfo: () => apiClient.get('/api/storage/cleanup-info'),
  getRecommendations: () => apiClient.get('/api/storage/recommendations'),
  triggerCleanup: () => apiClient.post('/api/storage/trigger-cleanup'),
};

// dbt API
export const dbtApi = {
  generateSources: (connectionId) => apiClient.post(`/api/dbt/${connectionId}/generate-sources`),
  generateDocs: (connectionId) => apiClient.post(`/api/dbt/${connectionId}/generate-docs`),
  sourceFreshness: (connectionId) => apiClient.post(`/api/dbt/${connectionId}/source-freshness`),
  getCatalog: (connectionId) => apiClient.get(`/api/dbt/${connectionId}/catalog`),
  getManifest: (connectionId) => apiClient.get(`/api/dbt/${connectionId}/manifest`),
  getSources: (connectionId) => apiClient.get(`/api/dbt/${connectionId}/sources`),
  getLineage: (connectionId) => apiClient.get(`/api/dbt/${connectionId}/lineage`),
  getStatus: (connectionId) => apiClient.get(`/api/dbt/${connectionId}/status`),
  cleanup: (connectionId) => apiClient.delete(`/api/dbt/${connectionId}/artifacts`),
};

// Local ETL API
export const localEtlApi = {
  getSettings: () => apiClient.get('/api/local-etl/settings'),
  updateSettings: (storagePath) => apiClient.put('/api/local-etl/settings', { storage_path: storagePath }),
  browse: (path) => apiClient.get('/api/local-etl/browse', { params: { path } }),
  getFiles: () => apiClient.get('/api/local-etl/files'),
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/local-etl/upload', formData, {
      headers: { 'Content-Type': undefined },
      timeout: 120000,
    });
  },
  deleteFile: (filename) => apiClient.delete(`/api/local-etl/files/${encodeURIComponent(filename)}`),
  getSchema: (filename) => apiClient.get(`/api/local-etl/schema/${encodeURIComponent(filename)}`),
  query: (sql, limit) => apiClient.post('/api/local-etl/query', { sql, limit }),
  exportQuery: async (sql) => {
    const response = await axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
      timeout: 120000,
      responseType: 'blob',
    }).post('/api/local-etl/query/export', { sql }, {
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  },

  // ETL pipeline endpoints (file → SQL Server)
  listConnections: () => apiClient.get('/api/local-etl/connections'),
  listDestinationTables: (connId) => apiClient.get(`/api/local-etl/connections/${connId}/tables`),
  inspectTable: (connId, schema, table) =>
    apiClient.post(`/api/local-etl/connections/${connId}/inspect-table`, { schema, table }),
  getSourceSchema: (filename) =>
    apiClient.get(`/api/local-etl/source-schema/${encodeURIComponent(filename)}`),
  runPipeline: (payload) =>
    apiClient.post('/api/local-etl/pipelines/run', payload, { timeout: 300000 }),
  runSavedPipeline: (id, payload = {}) =>
    apiClient.post(`/api/local-etl/pipelines/${id}/run`, payload, { timeout: 300000 }),
  listPipelines: () => apiClient.get('/api/local-etl/pipelines'),
  createPipeline: (payload) => apiClient.post('/api/local-etl/pipelines', payload),
  updatePipeline: (id, payload) => apiClient.put(`/api/local-etl/pipelines/${id}`, payload),
  deletePipeline: (id) => apiClient.delete(`/api/local-etl/pipelines/${id}`),
  listPipelineRuns: (params = {}) =>
    apiClient.get('/api/local-etl/pipeline-runs', { params }),
  getPipelineRun: (runId) =>
    apiClient.get(`/api/local-etl/pipeline-runs/${runId}`),
};

// Setup API (first-run wizard for the desktop bundle)
export const setupApi = {
  getStatus: () => apiClient.get('/api/setup/status'),
  testConnection: (payload) => apiClient.post('/api/setup/test', payload, { timeout: 15000 }),
  configure: (payload) => apiClient.post('/api/setup/configure', payload, { timeout: 30000 }),
};

// Health check
export const healthCheck = () => apiClient.get('/health');

export default apiClient;
