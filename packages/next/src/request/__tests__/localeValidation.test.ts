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
  const originalDisableInvalidLocaleWarning =
    process.env._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING;
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockI18NConfig.getLocales.mockReturnValue(['en', 'fr']);

    mockGt.determineLocale.mockImplementation(
      (locales: string[], approvedLocales: string[]) => {
        const standardizedLocales = locales.flatMap((locale) => {
          try {
            return Intl.getCanonicalLocales(locale)[0] || [];
          } catch {
            return [];
          }
        });
        return approvedLocales.find((locale) =>
          standardizedLocales.includes(locale)
        );
      }
    );
  });

  afterEach(() => {
    if (originalDisableInvalidLocaleWarning === undefined) {
      delete process.env._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING;
    } else {
      process.env._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING =
        originalDisableInvalidLocaleWarning;
    }
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

  it('does not warn for invalid request locales when disabled by env', () => {
    process.env._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING = 'true';

    expect(
      resolveLocaleOrDefault(
        'llms.txt',
        mockI18NConfig as unknown as I18NConfiguration,
        mockGt
      )
    ).toBe('en');

    expect(consoleWarnSpy).not.toHaveBeenCalled();
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

  it('resolves supported locales with non-standard casing', () => {
    mockI18NConfig.getLocales.mockReturnValue(['en', 'zh-CN']);

    expect(
      resolveLocaleOrDefault(
        'ZH-cn',
        mockI18NConfig as unknown as I18NConfiguration,
        mockGt
      )
    ).toBe('zh-CN');

    expect(consoleWarnSpy).not.toHaveBeenCalled();
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
