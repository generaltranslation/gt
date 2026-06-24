import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('determineLocale', () => {
  beforeEach(() => {
    const cookies = new Map<string, string>();
    vi.resetModules();
    vi.stubGlobal('navigator', { languages: [] });
    vi.stubGlobal('document', {
      get cookie() {
        return Array.from(cookies, ([name, value]) => `${name}=${value}`).join(
          '; '
        );
      },
      set cookie(value: string) {
        const [cookie] = value.split(';');
        const [name, cookieValue] = cookie.split('=');
        cookies.set(name, cookieValue);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses a string locale as a single locale candidate', async () => {
    vi.stubGlobal('navigator', { languages: ['en-US'] });

    const { initializeI18nConfig } = await import('gt-i18n/internal');
    const { createOrUpdateBrowserConditionStore } =
      await import('./createBrowserConditionStore');

    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['fr', 'zh'],
    });

    expect(
      createOrUpdateBrowserConditionStore({ locale: 'fr' }).getLocale()
    ).toBe('fr');
  });

  it('preserves locale candidate arrays', async () => {
    vi.stubGlobal('navigator', { languages: ['en-US'] });

    const { initializeI18nConfig } = await import('gt-i18n/internal');
    const { createOrUpdateBrowserConditionStore } =
      await import('./createBrowserConditionStore');

    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['fr', 'zh'],
    });

    expect(
      createOrUpdateBrowserConditionStore({ locale: ['zh', 'fr'] }).getLocale()
    ).toBe('zh');
  });
});
