import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearMismatchedLocaleCookie } from '../useDetermineLocale';

describe('clearMismatchedLocaleCookie', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears a locale cookie that disagrees with the resolved locale', () => {
    let cookie = 'gt-locale=fr; other=value';
    vi.stubGlobal('document', {
      get cookie() {
        return cookie;
      },
      set cookie(value: string) {
        cookie = value;
      },
    });

    clearMismatchedLocaleCookie({
      locale: 'en',
      localeCookieName: 'gt-locale',
    });

    expect(cookie).toBe('gt-locale=;path=/');
  });

  it('preserves a locale cookie that matches by custom alias', () => {
    let cookie = 'gt-locale=brand-french';
    vi.stubGlobal('document', {
      get cookie() {
        return cookie;
      },
      set cookie(value: string) {
        cookie = value;
      },
    });

    clearMismatchedLocaleCookie({
      locale: 'fr',
      localeCookieName: 'gt-locale',
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });

    expect(cookie).toBe('gt-locale=brand-french');
  });
});
