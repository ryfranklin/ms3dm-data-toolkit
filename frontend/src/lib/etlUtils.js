/**
 * Pure helpers shared between LocalETL components. Kept in their own module
 * (no React imports) so they can be unit-tested without a DOM.
 */

/**
 * Mirrors the backend's `_view_name` in services/duckdb_query.py — DuckDB's
 * auto-registered view name for an uploaded file. KEEP IN SYNC with the
 * backend or `INSERT SELECT * FROM <view>` shortcuts will break.
 */
export function viewName(filename) {
  if (!filename) return 'unnamed';
  const stem = filename.replace(/\.[^.]+$/, '');
  let name = stem.replace(/[^a-zA-Z0-9_]/g, '_');
  if (name && /^[0-9]/.test(name)) name = `f_${name}`;
  return name || 'unnamed';
}

export function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function joinPath(dir, name) {
  if (!dir) return name;
  return dir.endsWith('/') ? `${dir}${name}` : `${dir}/${name}`;
}

export function formatDuration(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
