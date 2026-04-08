import React, { useState } from 'react';

export default function DocumentMeta({ categories, onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categories[0] || 'General');
  const [customCategory, setCustomCategory] = useState('');
  const [docType, setDocType] = useState('note');
  const [tags, setTags] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const resolvedCategory = category === '__new__' ? customCategory.trim() || 'General' : category;
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSubmit({
      title: title.trim(),
      category: resolvedCategory,
      doc_type: docType,
      tags: tagList,
      content: docType === 'diagram' ? '```mermaid\ngraph TD\n  A[Start] --> B[End]\n```\n' : '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-4">New Document</h3>

        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          <option value="__new__">+ New Category</option>
        </select>
        {category === '__new__' && (
          <input
            type="text"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="Enter category name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        {category !== '__new__' && <div className="mb-3" />}

        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="docType"
              value="note"
              checked={docType === 'note'}
              onChange={() => setDocType('note')}
            />
            Note
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="docType"
              value="diagram"
              checked={docType === 'diagram'}
              onChange={() => setDocType('diagram')}
            />
            Diagram
          </label>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Comma-separated tags"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
