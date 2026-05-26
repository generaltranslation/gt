import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserI18nCache } from '../BrowserI18nCache';

describe('BrowserI18nCache', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('preserves valid html lang overrides outside configured translation locales', () => {
    const documentElement = {
      lang: '',
      dir: '',
    };
    vi.stubGlobal('document', { documentElement });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = new BrowserI18nCache({
      defaultLocale: 'en-US',
      locales: ['en-US'],
      loadTranslations: vi.fn(),
    });

    cache.updateHtmlTag('en-US', {
      lang: 'en-GB',
      updateHtmlLangTag: true,
      updateHtmlDirTag: false,
    });

    expect(documentElement.lang).toBe('en-GB');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
