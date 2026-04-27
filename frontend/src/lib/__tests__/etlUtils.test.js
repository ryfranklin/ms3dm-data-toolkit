import { describe, expect, test } from 'vitest';
import { viewName, formatSize, joinPath, formatDuration } from '../etlUtils';

describe('viewName', () => {
  test('strips the extension', () => {
    expect(viewName('customers.csv')).toBe('customers');
    expect(viewName('orders.parquet')).toBe('orders');
  });

  test('replaces invalid SQL identifier chars with underscores', () => {
    expect(viewName('Customer Address.csv')).toBe('Customer_Address');
    expect(viewName('source-2026-01.json')).toBe('source_2026_01');
    expect(viewName('weird name (final).csv')).toBe('weird_name__final_');
  });

  test('prefixes leading-digit names with f_', () => {
    // SQL identifiers cannot start with a digit, so we rewrite them.
    expect(viewName('2026_data.csv')).toBe('f_2026_data');
    expect(viewName('1.json')).toBe('f_1');
  });

  test('returns "unnamed" for empty / undefined input', () => {
    expect(viewName('')).toBe('unnamed');
    expect(viewName(undefined)).toBe('unnamed');
    expect(viewName(null)).toBe('unnamed');
  });
});

describe('formatSize', () => {
  test('uses B / KB / MB units', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  test('handles missing values without throwing', () => {
    expect(formatSize(null)).toBe('');
    expect(formatSize(undefined)).toBe('');
  });
});

describe('joinPath', () => {
  test('joins with a single slash', () => {
    expect(joinPath('/tmp', 'foo.csv')).toBe('/tmp/foo.csv');
    expect(joinPath('./local', 'file')).toBe('./local/file');
  });

  test("doesn't double the slash if the dir already ends in one", () => {
    expect(joinPath('/tmp/', 'foo.csv')).toBe('/tmp/foo.csv');
  });

  test('passes through name when dir is empty', () => {
    expect(joinPath('', 'file.csv')).toBe('file.csv');
  });
});

describe('formatDuration', () => {
  test('renders sub-second as ms', () => {
    expect(formatDuration(0)).toBe('0 ms');
    expect(formatDuration(123.7)).toBe('124 ms');
  });

  test('renders >= 1s with two-decimal seconds', () => {
    expect(formatDuration(1500)).toBe('1.50 s');
    expect(formatDuration(60_000)).toBe('60.00 s');
  });

  test('handles null / undefined', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
  });
});
