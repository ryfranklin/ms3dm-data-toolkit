import React, { useState, useEffect, useCallback } from 'react';
import { localEtlApi } from '../../api/client';
import StorageSettings from './StorageSettings';
import FileManager from './FileManager';
import SQLWorkbench from './SQLWorkbench';
import ETLPipelinePanel from './ETLPipelinePanel';
import TargetsPanel from './TargetsPanel';

const SUB_TABS = [
  { key: 'sandbox', label: 'Sandbox' },
  { key: 'etl', label: 'ETL Pipelines' },
  { key: 'targets', label: 'Targets' },
];

export default function LocalETLPanel() {
  const [activeTab, setActiveTab] = useState('sandbox');
  const [storagePath, setStoragePath] = useState('./local_storage');
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  // Bumped whenever targets change so the wizard can re-fetch connections.
  const [targetsVersion, setTargetsVersion] = useState(0);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await localEtlApi.getSettings();
      setStoragePath(res.data.storage_path);
    } catch {
      // use default
    }
  }, []);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await localEtlApi.getFiles();
      setFiles(res.data.files);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings().then(fetchFiles);
  }, [fetchSettings, fetchFiles]);

  const handleSettingsSaved = (newPath) => {
    setStoragePath(newPath);
    setShowSettings(false);
    fetchFiles();
  };

  const handleFileUploaded = () => {
    fetchFiles();
  };

  const handleFileDeleted = (filename) => {
    if (selectedFile === filename) setSelectedFile(null);
    fetchFiles();
  };

  const handleInsertTable = (tableName) => {
    window.dispatchEvent(new CustomEvent('localetl:insert-table', { detail: tableName }));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Sub-tab bar + config */}
      <div className="bg-white border-b border-gray-200 flex items-center justify-between">
        <nav className="flex" aria-label="Local ETL sub-tabs">
          {SUB_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
                activeTab === t.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3 px-4 text-sm text-gray-600">
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Storage settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{storagePath}</span>
          <span className="text-xs text-gray-400">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Tab panels — both stay mounted, hidden via CSS, so wizard state survives tab switches */}
      <div className={`flex-1 overflow-hidden ${activeTab === 'sandbox' ? 'flex' : 'hidden'}`}>
        <FileManager
          files={files}
          loading={loading}
          storagePath={storagePath}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          onFileUploaded={handleFileUploaded}
          onFileDeleted={handleFileDeleted}
          onInsertTable={handleInsertTable}
        />
        <SQLWorkbench storagePath={storagePath} />
      </div>

      <div className={`flex-1 overflow-hidden ${activeTab === 'etl' ? '' : 'hidden'}`}>
        <ETLPipelinePanel
          files={files}
          storagePath={storagePath}
          onFilesChanged={fetchFiles}
          onGoToTargets={() => setActiveTab('targets')}
          targetsVersion={targetsVersion}
        />
      </div>

      <div className={`flex-1 overflow-hidden ${activeTab === 'targets' ? '' : 'hidden'}`}>
        <TargetsPanel onTargetsChanged={() => setTargetsVersion((v) => v + 1)} />
      </div>

      {/* Settings modal */}
      {showSettings && (
        <StorageSettings
          currentPath={storagePath}
          onSave={handleSettingsSaved}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
