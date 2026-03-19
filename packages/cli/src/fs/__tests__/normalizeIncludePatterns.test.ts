import { describe, it, expect } from 'vitest';
import { normalizeIncludePatterns } from '../config/parseFilesConfig.js';

describe('normalizeIncludePatterns', () => {
  it('handles plain string patterns', () => {
    const result = normalizeIncludePatterns([
      './docs/**/*.mdx',
      './i18n/[locale].json',
    ]);
    expect(result.paths).toEqual(['./docs/**/*.mdx', './i18n/[locale].json']);
    expect(result.publishPatterns).toEqual([]);
    expect(result.unpublishPatterns).toEqual([]);
  });

  it('extracts pattern from objects with publish: true', () => {
    const result = normalizeIncludePatterns([
      { pattern: './marketing/**/*.mdx', publish: true },
    ]);
    expect(result.paths).toEqual(['./marketing/**/*.mdx']);
    expect(result.publishPatterns).toEqual(['./marketing/**/*.mdx']);
    expect(result.unpublishPatterns).toEqual([]);
  });

  it('extracts pattern from objects with publish: false', () => {
    const result = normalizeIncludePatterns([
      { pattern: './internal/**/*.json', publish: false },
    ]);
    expect(result.paths).toEqual(['./internal/**/*.json']);
    expect(result.publishPatterns).toEqual([]);
    expect(result.unpublishPatterns).toEqual(['./internal/**/*.json']);
  });

  it('handles objects with no publish flag', () => {
    const result = normalizeIncludePatterns([{ pattern: './docs/**/*.mdx' }]);
    expect(result.paths).toEqual(['./docs/**/*.mdx']);
    expect(result.publishPatterns).toEqual([]);
    expect(result.unpublishPatterns).toEqual([]);
  });

  it('handles mixed patterns', () => {
    const result = normalizeIncludePatterns([
      './docs/**/*.mdx',
      { pattern: './marketing/**/*.mdx', publish: true },
      { pattern: './internal/**/*.json', publish: false },
      { pattern: './other/**/*.yaml' },
    ]);
    expect(result.paths).toEqual([
      './docs/**/*.mdx',
      './marketing/**/*.mdx',
      './internal/**/*.json',
      './other/**/*.yaml',
    ]);
    expect(result.publishPatterns).toEqual(['./marketing/**/*.mdx']);
    expect(result.unpublishPatterns).toEqual(['./internal/**/*.json']);
  });

  it('handles empty array', () => {
    const result = normalizeIncludePatterns([]);
    expect(result.paths).toEqual([]);
    expect(result.publishPatterns).toEqual([]);
    expect(result.unpublishPatterns).toEqual([]);
  });
});
