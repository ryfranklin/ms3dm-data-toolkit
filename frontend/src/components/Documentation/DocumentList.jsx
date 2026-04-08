import React, { useState } from 'react';

export default function DocumentList({ documents, categories, selectedId, onSelect }) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});

  const filtered = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.preview || '').toLowerCase().includes(search.toLowerCase())
  );

  const grouped = {};
  for (const doc of filtered) {
    const cat = doc.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(doc);
  }

  const toggleCategory = (cat) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className="w-64 border-r border-gray-200 bg-white flex flex-col min-h-0">
      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents..."
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(grouped).length === 0 && (
          <div className="p-4 text-sm text-gray-400 text-center">No documents</div>
        )}
        {Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, docs]) => (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide hover:bg-gray-100"
              >
                <span>{category}</span>
                <span className="text-gray-400">
                  {collapsed[category] ? '+' : '-'} ({docs.length})
                </span>
              </button>
              {!collapsed[category] &&
                docs.map((doc) => (
                  <button
                    key={doc.doc_id}
                    onClick={() => onSelect(doc.doc_id)}
                    className={`w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-blue-50 ${
                      selectedId === doc.doc_id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-800 truncate">{doc.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <span>{doc.doc_type === 'diagram' ? 'Diagram' : 'Note'}</span>
                      {doc.tags?.length > 0 && (
                        <>
                          <span>-</span>
                          <span className="truncate">{doc.tags.slice(0, 2).join(', ')}</span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          ))}
      </div>
    </div>
  );
}
