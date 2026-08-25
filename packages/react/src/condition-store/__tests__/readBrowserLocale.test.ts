import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookieValues = vi.hoisted(
  () => new Map<string, string | undefined>()
);

vi.mock('../cookies', () => ({
  getCookieValue: ({ cookieName }: { cookieName: string }) =>
    mockCookieValues.get(cookieName),
}));

import { readBrowserLocale } from '../readBrowserLocale';

describe('readBrowserLocale', () => {
  beforeEach(() => {
    mockCookieValues.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not throw when navigator is undefined (e.g. during SSR)', () => {
    vi.stubGlobal('navigator', undefined);

    expect(() => readBrowserLocale('generaltranslation.locale')).not.toThrow();
  });

  it('falls back to the cookie locale alone when navigator is undefined', () => {
    vi.stubGlobal('navigator', undefined);
    mockCookieValues.set('generaltranslation.locale', 'de');

    expect(readBrowserLocale('generaltranslation.locale')).toEqual(['de']);
  });

  it('appends navigator languages after the cookie locale when available', () => {
    vi.stubGlobal('navigator', { languages: ['fr-FR', 'en-US'] });
    mockCookieValues.set('generaltranslation.locale', 'de');

    expect(readBrowserLocale('generaltranslation.locale')).toEqual([
      'de',
      'fr-FR',
      'en-US',
    ]);
  });

  it('returns an empty array when neither a cookie nor navigator locales are available', () => {
    vi.stubGlobal('navigator', undefined);

    expect(readBrowserLocale('generaltranslation.locale')).toEqual([]);
  });
});
