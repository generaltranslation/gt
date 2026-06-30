import { describe, expect, it } from 'vitest';
import { localizePathSegment } from '../localizePathSegment.js';

describe('localizePathSegment', () => {
  const knownLocales = new Set(['en', 'es', 'fr']);

  it('prefixes path-like values with the target locale', () => {
    expect(localizePathSegment('/docs/api', 'es', knownLocales)).toBe(
      '/es/docs/api'
    );
    expect(localizePathSegment('docs/api', 'es', knownLocales)).toBe(
      'es/docs/api'
    );
  });

  it('replaces existing known-locale prefixes', () => {
    expect(localizePathSegment('/en/docs/api', 'es', knownLocales)).toBe(
      '/es/docs/api'
    );
  });

  it('preserves surrounding whitespace', () => {
    expect(localizePathSegment('  /docs/api  ', 'es', knownLocales)).toBe(
      '  /es/docs/api  '
    );
  });

  it('returns null when the value is already normalized for the target locale', () => {
    expect(localizePathSegment('/es/docs/api', 'es', knownLocales)).toBeNull();
  });

  it('skips external, anchor, and explicitly relative values', () => {
    expect(
      localizePathSegment('https://example.com/docs', 'es', knownLocales)
    ).toBeNull();
    expect(
      localizePathSegment('//example.com/docs', 'es', knownLocales)
    ).toBeNull();
    expect(localizePathSegment('#docs', 'es', knownLocales)).toBeNull();
    expect(localizePathSegment('./docs', 'es', knownLocales)).toBeNull();
    expect(localizePathSegment('../docs', 'es', knownLocales)).toBeNull();
  });

  it('can emit a trailing slash for empty URL-style paths', () => {
    expect(localizePathSegment('/', 'es', knownLocales)).toBe('/es');
    expect(
      localizePathSegment('/', 'es', knownLocales, {
        trailingSlashWhenEmpty: true,
      })
    ).toBe('/es/');
  });
});
