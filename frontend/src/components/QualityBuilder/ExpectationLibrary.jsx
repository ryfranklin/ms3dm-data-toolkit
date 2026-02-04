import React, { useState, useEffect } from 'react';

function ExpectationLibrary({ onAddExpectation }) {
  const [library, setLibrary] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({
    'column_value': true,
    'table_checks': true,
    'freshness': true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/expectations/library');
      const data = await response.json();
      setLibrary(data);
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500">Loading checks...</p>
      </div>
    );
  }

  if (!library) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-500">Failed to load check library</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Check Library</h2>
      <p className="text-xs text-gray-600 mb-4">Drag checks to canvas to add</p>
      
      <div className="space-y-3">
        {Object.entries(library.categories).map(([categoryId, category]) => (
          <div key={categoryId}>
            <button
              onClick={() => toggleCategory(categoryId)}
              className="flex items-center w-full text-left mb-2 hover:bg-gray-50 rounded px-1 py-1"
            >
              <span className="text-xs mr-1">
                {expandedCategories[categoryId] ? '▼' : '▶'}
              </span>
              <span className="mr-2">{category.icon}</span>
              <h3 className="text-xs font-medium text-gray-700 uppercase">
                {category.name}
              </h3>
            </button>
            
            {expandedCategories[categoryId] && (
              <div className="space-y-1 ml-2">
                {category.expectations.map((expectation) => (
                  <button
                    key={expectation.id}
                    onClick={() => onAddExpectation(expectation)}
                    className="w-full flex items-start px-2 py-2 text-xs bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 text-left group transition-colors"
                    title={expectation.description}
                  >
                    <span className="mr-2 mt-0.5 text-base">{expectation.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {expectation.name}
                      </div>
                      <div className="text-gray-500 text-[10px] mt-0.5 line-clamp-2">
                        {expectation.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <p className="font-medium">💡 Quick Tips:</p>
          <ul className="list-disc list-inside text-[11px] space-y-1 text-gray-500">
            <li>Click to add checks</li>
            <li>Configure in right panel</li>
            <li>Run to see results</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ExpectationLibrary;
