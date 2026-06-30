import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { I18NConfiguration } from '../../config-dir/I18NConfiguration';
import { localeStore } from '../localeStore';
import { isLocaleSupported, resolveLocaleOrDefault } from '../localeValidation';
import { registerLocale } from '../registerLocale';

const mockGt = vi.hoisted(() => ({
  determineLocale: vi.fn(),
  resolveAliasLocale: vi.fn((locale: string) => locale),
}));

const mockI18NConfig = vi.hoisted(() => ({
  getDefaultLocale: vi.fn(() => 'en'),
  getGTClass: vi.fn(() => mockGt),
  getLocales: vi.fn(() => ['en', 'fr']),
}));

vi.mock('../../config-dir/getI18NConfig', () => ({
  getI18NConfig: () => mockI18NConfig,
}));

describe('locale validation', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockGt.determineLocale.mockImplementation(
      (locales: string[], approvedLocales: string[]) =>
        locales.find((locale) => approvedLocales.includes(locale))
    );
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('returns supported locales without warning', () => {
    expect(
      resolveLocaleOrDefault(
        'fr',
        mockI18NConfig as unknown as I18NConfiguration,
        mockGt
      )
    ).toBe('fr');

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('falls back to the default locale for invalid request locales', () => {
    expect(
      resolveLocaleOrDefault(
        'llms.txt',
        mockI18NConfig as unknown as I18NConfiguration,
        mockGt
      )
    ).toBe('en');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Locale "llms.txt" is not valid')
    );
  });

  it('falls back to the default locale for unsupported request locales', () => {
    expect(
      resolveLocaleOrDefault(
        'de',
        mockI18NConfig as unknown as I18NConfiguration,
        mockGt
      )
    ).toBe('en');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Locale "de" is not valid or is not supported')
    );
  });

  it('does not warn when no request locale is available', () => {
    expect(
      resolveLocaleOrDefault(
        undefined,
        mockI18NConfig as unknown as I18NConfiguration,
        mockGt
      )
    ).toBe('en');

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('checks if a locale is supported by the gt-next config', () => {
    expect(isLocaleSupported('fr')).toBe(true);
    expect(isLocaleSupported('llms.txt')).toBe(false);
  });

  it('falls back when registering an unsupported locale', () => {
    localeStore.run('fr', () => {
      registerLocale('llms.txt');
      expect(localeStore.getStore()).toBe('en');
    });
  });
});
