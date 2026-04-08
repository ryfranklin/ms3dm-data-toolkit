import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

let idCounter = 0;

export default function MermaidRenderer({ code }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!code || !containerRef.current) return;

    const id = `mermaid-${++idCounter}`;
    let cancelled = false;

    (async () => {
      try {
        const { svg } = await mermaid.render(id, code.trim());
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Invalid Mermaid syntax');
          if (containerRef.current) containerRef.current.innerHTML = '';
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div>
      <div ref={containerRef} className="flex justify-center overflow-auto" />
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          <span className="font-medium">Mermaid error:</span> {error}
        </div>
      )}
    </div>
  );
}
