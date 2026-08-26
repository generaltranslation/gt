import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookieValues = vi.hoisted(
  () => new Map<string, string | undefined>()
);

vi.mock('../cookies', () => ({
  getCookieValue: ({ cookieName }: { cookieName: string }) =>
    mockCookieValues.get(cookieName),
}));

import { readBrowserLocale } from '../readBrowserLocale';

// `vi.stubGlobal('navigator', undefined)` only assigns `undefined` to an
// already-declared global — it does not reproduce the real-world failure,
// where `navigator` is an unbound identifier (no property at all) and a
// bare reference throws a ReferenceError. We delete the property outright
// and restore its original descriptor afterward to simulate that.
let originalNavigatorDescriptor: PropertyDescriptor | undefined;

function deleteGlobalNavigator() {
  delete (globalThis as { navigator?: unknown }).navigator;
}

describe('readBrowserLocale', () => {
  beforeEach(() => {
    mockCookieValues.clear();
    originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator'
    );
  });

  afterEach(() => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(
        globalThis,
        'navigator',
        originalNavigatorDescriptor
      );
    } else {
      deleteGlobalNavigator();
    }
  });

  it('does not throw when navigator is unbound (e.g. during SSR)', () => {
    deleteGlobalNavigator();

    expect(() => readBrowserLocale('generaltranslation.locale')).not.toThrow();
  });

  it('falls back to the cookie locale alone when navigator is unbound', () => {
    deleteGlobalNavigator();
    mockCookieValues.set('generaltranslation.locale', 'de');

    expect(readBrowserLocale('generaltranslation.locale')).toEqual(['de']);
  });

  it('appends navigator languages after the cookie locale when available', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { languages: ['fr-FR', 'en-US'] },
      configurable: true,
    });
    mockCookieValues.set('generaltranslation.locale', 'de');

    expect(readBrowserLocale('generaltranslation.locale')).toEqual([
      'de',
      'fr-FR',
      'en-US',
    ]);
  });

  it('returns an empty array when neither a cookie nor navigator locales are available', () => {
    deleteGlobalNavigator();

    expect(readBrowserLocale('generaltranslation.locale')).toEqual([]);
  });
});
