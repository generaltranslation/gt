import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserI18nManager } from '../BrowserI18nManager';

describe('BrowserI18nManager', () => {
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
    const manager = new BrowserI18nManager({
      defaultLocale: 'en-US',
      locales: ['en-US'],
      loadTranslations: vi.fn(),
    });

    manager.updateHtmlTag('en-US', {
      lang: 'en-GB',
      updateHtmlLangTag: true,
      updateHtmlDirTag: false,
    });

    expect(documentElement.lang).toBe('en-GB');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
