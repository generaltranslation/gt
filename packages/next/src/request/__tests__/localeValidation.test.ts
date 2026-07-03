import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import {
  AsyncConditionStore,
  getAsyncConditionStore,
  setAsyncConditionStore,
} from '../../condition-store/AsyncConditionStore';
import { isLocaleSupported, resolveLocaleOrDefault } from '../localeValidation';
import { registerLocale } from '../registerLocale';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: {
    i18n?: {
      conditionStore?: unknown;
      i18nConfig?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

function resetI18nConfigGlobal() {
  const globalObj = globalThis as TestGlobal;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(
      globalObj.__generaltranslation.i18n,
      'conditionStore'
    );
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nConfig');
  }
}

function setupI18nConfig({
  defaultLocale = 'en',
  locales = ['en', 'fr'],
}: {
  defaultLocale?: string;
  locales?: string[];
} = {}) {
  resetI18nConfigGlobal();
  initializeI18nConfig({ defaultLocale, locales });
}

describe('locale validation', () => {
  const originalDisableInvalidLocaleWarning =
    process.env._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING;
    setupI18nConfig();
    setAsyncConditionStore(
      new AsyncConditionStore({
        getLocale: async () => 'fr',
      })
    );
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalDisableInvalidLocaleWarning === undefined) {
      delete process.env._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING;
    } else {
      process.env._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING =
        originalDisableInvalidLocaleWarning;
    }
    consoleWarnSpy.mockRestore();
    resetI18nConfigGlobal();
  });

  it('returns supported locales without warning', () => {
    expect(resolveLocaleOrDefault('fr')).toBe('fr');

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('falls back to the default locale for invalid request locales', () => {
    expect(resolveLocaleOrDefault('llms.txt')).toBe('en');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Locale "llms.txt" is not valid')
    );
  });

  it('does not warn for invalid request locales when disabled by env', () => {
    process.env._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING = 'true';

    expect(resolveLocaleOrDefault('llms.txt')).toBe('en');

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('falls back to the default locale for unsupported request locales', () => {
    expect(resolveLocaleOrDefault('de')).toBe('en');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Locale "de" is not valid or is not supported')
    );
  });

  it('resolves supported locales with non-standard casing', () => {
    setupI18nConfig({ locales: ['en', 'zh-CN'] });

    expect(resolveLocaleOrDefault('ZH-cn')).toBe('zh-CN');

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('does not warn when no request locale is available', () => {
    expect(resolveLocaleOrDefault(undefined)).toBe('en');

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('checks if a locale is supported by the gt-next config', () => {
    expect(isLocaleSupported('fr')).toBe(true);
    expect(isLocaleSupported('llms.txt')).toBe(false);
  });

  it('falls back when registering an unsupported locale', async () => {
    registerLocale('llms.txt');

    await expect(getAsyncConditionStore().getLocale()).resolves.toBe('en');
  });
});
