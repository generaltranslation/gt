import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import createNextMiddleware from '../createNextMiddleware';

// Mock dependencies
vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    next: vi.fn(() => ({
      headers: { set: vi.fn() },
      cookies: { set: vi.fn(), delete: vi.fn() },
    })),
    rewrite: vi.fn(() => ({
      headers: { set: vi.fn() },
      cookies: { set: vi.fn(), delete: vi.fn() },
    })),
    redirect: vi.fn(() => ({
      headers: { set: vi.fn() },
      cookies: { set: vi.fn(), delete: vi.fn() },
    })),
  },
}));

vi.mock('generaltranslation', () => ({
  GT: vi.fn(() => ({
    isValidLocale: vi.fn((locale: string) =>
      ['en', 'fr', 'es', 'de'].includes(locale)
    ),
    determineLocale: vi.fn(
      (candidates: string[], approved: string[]) =>
        candidates.find((locale) => approved.includes(locale)) || approved[0]
    ),
    resolveAliasLocale: vi.fn((locale: string) => locale),
  })),
  standardizeLocale: vi.fn((locale: string) => locale),
  isSameDialect: vi.fn((a: string, b: string) => a === b),
  getLocaleProperties: vi.fn((locale: string) => ({
    name: `${locale} Language`,
  })),
}));

vi.mock('generaltranslation/internal', () => ({
  libraryDefaultLocale: 'en',
}));

vi.mock('../errors/createErrors', () => ({
  createUnsupportedLocalesWarning: vi.fn(() => 'Warning message'),
}));

vi.mock('../utils/cookies', () => ({
  defaultLocaleRoutingEnabledCookieName: 'gt-locale-routing-enabled',
  defaultReferrerLocaleCookieName: 'gt-referrer-locale',
  defaultResetLocaleCookieName: 'gt-reset-locale',
}));

vi.mock('gt-react/internal', () => ({
  defaultLocaleCookieName: 'gt-locale',
}));

vi.mock('../utils/headers', () => ({
  defaultLocaleHeaderName: 'x-gt-locale',
}));

describe('createNextMiddleware - Factory Tests', () => {
  let originalEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();

    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      _GENERALTRANSLATION_I18N_CONFIG_PARAMS: JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'fr', 'es'],
      }),
      _GENERALTRANSLATION_GT_SERVICES_ENABLED: 'false',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('middleware factory', () => {
    it('should create middleware function with default options', () => {
      const middleware = createNextMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should create middleware function with custom options', () => {
      const middleware = createNextMiddleware({
        localeRouting: false,
        prefixDefaultLocale: true,
        ignoreSourceMaps: false,
        pathConfig: { '/about': '/about-us' },
      });
      expect(typeof middleware).toBe('function');
    });

    it('should throw error for invalid default locale', () => {
      process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
        defaultLocale: 'invalid',
        locales: ['en', 'fr'],
      });

      expect(() => createNextMiddleware()).toThrow(
        'gt-next middleware: defaultLocale "invalid" is not a valid locale.'
      );
    });

    it('should handle missing environment config gracefully', () => {
      delete process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;

      const middleware = createNextMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should handle malformed environment config gracefully', () => {
      process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = 'invalid-json';
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const middleware = createNextMiddleware();
      expect(typeof middleware).toBe('function');
      expect(consoleSpy).toHaveBeenCalledWith(
        'gt-next middleware:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should warn about unsupported locales', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'fr', 'invalid1', 'invalid2'],
      });

      createNextMiddleware();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'gt-next: The following locales are currently unsupported'
        )
      );

      consoleSpy.mockRestore();
    });

    it('should handle custom headers and cookies configuration', () => {
      process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        headersAndCookies: {
          localeCookieName: 'custom-locale',
          localeHeaderName: 'x-custom-locale',
        },
      });

      const middleware = createNextMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should handle gt services enabled configuration', () => {
      process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED = 'true';

      const middleware = createNextMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should handle custom mapping in environment config', () => {
      process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        customMapping: {
          'en-US': { code: 'en' },
          'fr-CA': { code: 'fr' },
        },
      });

      const middleware = createNextMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should create path mapping when pathConfig is provided', () => {
      const middleware = createNextMiddleware({
        pathConfig: {
          '/about': { en: '/about-us', fr: '/a-propos' },
          '/contact': '/contact-us',
        },
      });
      expect(typeof middleware).toBe('function');
    });
  });
});
