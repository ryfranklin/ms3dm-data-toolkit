import React, { useState, useEffect, useCallback } from 'react';
import { docsApi } from '../../api/client';
import DocumentList from './DocumentList';
import DocumentEditor from './DocumentEditor';
import DocumentMeta from './DocumentMeta';

const DEFAULT_CATEGORIES = ['General', 'Architecture', 'Pipelines', 'Runbooks'];

export default function Documentation() {
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await docsApi.getDocuments();
      setDocuments(res.data || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await docsApi.getCategories();
      const dbCats = res.data || [];
      const merged = [...new Set([...DEFAULT_CATEGORIES, ...dbCats])];
      setCategories(merged);
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchDocuments(), fetchCategories()]).finally(() => setLoading(false));
  }, [fetchDocuments, fetchCategories]);

  // Load full document when selected
  useEffect(() => {
    if (!selectedId) {
      setSelectedDoc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await docsApi.getDocument(selectedId);
        if (!cancelled) setSelectedDoc(res.data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  const handleCreate = async (data) => {
    try {
      const res = await docsApi.createDocument(data);
      setShowNewModal(false);
      await fetchDocuments();
      await fetchCategories();
      setSelectedId(res.data.doc_id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSave = async (data) => {
    if (!selectedId) return;
    try {
      const res = await docsApi.updateDocument(selectedId, data);
      setSelectedDoc(res.data);
      await fetchDocuments();
      await fetchCategories();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('Delete this document?')) return;
    try {
      await docsApi.deleteDocument(selectedId);
      setSelectedId(null);
      setSelectedDoc(null);
      await fetchDocuments();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.6)-3rem)] flex flex-col">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-medium hover:text-red-900">Dismiss</button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Documentation</h2>
        <div className="flex gap-2">
          {selectedId && (
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100"
            >
              Delete
            </button>
          )}
          <button
            onClick={() => setShowNewModal(true)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            New Document
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        <DocumentList
          documents={documents}
          categories={categories}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <DocumentEditor
          document={selectedDoc}
          categories={categories}
          onSave={handleSave}
        />
      </div>

      {/* New document modal */}
      {showNewModal && (
        <DocumentMeta
          categories={categories}
          onSubmit={handleCreate}
          onCancel={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}
