import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import MermaidRenderer from './MermaidRenderer';

export default function DocumentEditor({ document, categories, onSave }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [docType, setDocType] = useState('note');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (document) {
      setTitle(document.title || '');
      setCategory(document.category || 'General');
      setContent(document.content || '');
      setTags(Array.isArray(document.tags) ? document.tags.join(', ') : '');
      setDocType(document.doc_type || 'note');
      setDirty(false);
    }
  }, [document]);

  const handleChange = useCallback((setter) => (e) => {
    setter(e.target.value);
    setDirty(true);
  }, []);

  const handleSave = () => {
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSave({
      title,
      category,
      content,
      doc_type: docType,
      tags: tagList,
    });
    setDirty(false);
  };

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-sm">Select a document or create a new one</p>
        </div>
      </div>
    );
  }

  const codeRenderer = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : null;

    if (!inline && lang === 'mermaid') {
      return <MermaidRenderer code={String(children).replace(/\n$/, '')} />;
    }

    if (!inline && lang) {
      return (
        <SyntaxHighlighter style={oneLight} language={lang} PreTag="div" {...props}>
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      );
    }

    return (
      <code className={`${className || ''} bg-gray-100 px-1 py-0.5 rounded text-sm`} {...props}>
        {children}
      </code>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-white p-3 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={title}
          onChange={handleChange(setTitle)}
          placeholder="Document title"
          className="flex-1 min-w-[200px] px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={category}
          onChange={handleChange(setCategory)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          <option value="__new__">+ New Category</option>
        </select>
        {category === '__new__' && (
          <input
            type="text"
            placeholder="Category name"
            onChange={(e) => { setCategory(e.target.value); setDirty(true); }}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        <input
          type="text"
          value={tags}
          onChange={handleChange(setTags)}
          placeholder="Tags (comma-separated)"
          className="w-48 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSave}
          className={`px-4 py-1.5 rounded-md text-sm font-medium text-white ${
            dirty ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-default'
          }`}
        >
          {dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      {/* Split pane */}
      <div className="flex-1 flex min-h-0">
        {/* Editor */}
        <div className="w-1/2 flex flex-col border-r border-gray-200">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium uppercase tracking-wide">
            Markdown
          </div>
          <textarea
            value={content}
            onChange={handleChange(setContent)}
            className="flex-1 p-4 resize-none font-mono text-sm focus:outline-none"
            placeholder="Write your markdown here..."
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        <div className="w-1/2 flex flex-col">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium uppercase tracking-wide">
            Preview
          </div>
          <div className="flex-1 p-4 overflow-auto markdown-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: codeRenderer }}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
