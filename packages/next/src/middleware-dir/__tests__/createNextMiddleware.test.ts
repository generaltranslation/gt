import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import createNextMiddleware from '../createNextMiddleware';
import type { PathConfig } from '../utils';

// Mock all dependencies comprehensively
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
      ['en', 'fr', 'es', 'de', 'ja', 'zh', 'ar'].includes(locale)
    ),
    determineLocale: vi.fn(
      (candidates, approved) =>
        candidates.find((c) => approved.includes(c)) || approved[0]
    ),
    resolveAliasLocale: vi.fn((locale) => locale),
  })),
  standardizeLocale: vi.fn((locale) => locale),
  isSameDialect: vi.fn((a, b) => a === b),
  getLocaleProperties: vi.fn((locale) => ({ name: `${locale} Language` })),
}));

vi.mock('generaltranslation/internal', () => ({ libraryDefaultLocale: 'en' }));
vi.mock('../errors/createErrors', () => ({
  createUnsupportedLocalesWarning: vi.fn(() => 'Warning'),
}));
vi.mock('../utils/cookies', () => ({
  defaultLocaleRoutingEnabledCookieName: 'gt-locale-routing-enabled',
  defaultReferrerLocaleCookieName: 'gt-referrer-locale',
  defaultResetLocaleCookieName: 'gt-reset-locale',
}));
vi.mock('gt-react/internal', () => ({ defaultLocaleCookieName: 'gt-locale' }));
vi.mock('../utils/headers', () => ({ defaultLocaleHeaderName: 'x-gt-locale' }));

// Mock the utils module to avoid URL construction issues
vi.mock('../utils', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getResponse: vi.fn(() => ({
      headers: { set: vi.fn() },
      cookies: { set: vi.fn(), delete: vi.fn() },
    })),
  };
});

describe('createNextMiddleware - Comprehensive Advanced Tests', () => {
  let originalEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      _GENERALTRANSLATION_I18N_CONFIG_PARAMS: JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'fr', 'es', 'de'],
      }),
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Advanced Factory Configuration', () => {
    it('should handle complex real-world path configurations', () => {
      const realWorldPathConfig: PathConfig = {
        '/': { en: '/', fr: '/', es: '/', de: '/' },
        '/about': {
          en: '/about-us',
          fr: '/a-propos',
          es: '/acerca-de',
          de: '/uber-uns',
        },
        '/products': {
          en: '/products',
          fr: '/produits',
          es: '/productos',
          de: '/produkte',
        },
        '/products/[category]': {
          en: '/products/[category]',
          fr: '/produits/[category]',
          es: '/productos/[category]',
        },
        '/products/[category]/[product]': {
          en: '/products/[category]/[product]',
          fr: '/produits/[category]/[product]',
          es: '/productos/[category]/[product]',
        },
        '/blog/[year]/[month]/[slug]': {
          en: '/blog/[year]/[month]/[slug]',
          fr: '/blog/[year]/[month]/[slug]',
          es: '/articulo/[year]/[month]/[slug]',
        },
        '/docs/[...path]': {
          en: '/docs/[...path]',
          fr: '/documentation/[...path]',
        },
        '/api/v1/[...endpoints]': '/api/v1/[...endpoints]', // API routes typically not localized
      };

      const middleware = createNextMiddleware({
        localeRouting: true,
        prefixDefaultLocale: false,
        pathConfig: realWorldPathConfig,
      });

      expect(typeof middleware).toBe('function');
    });

    it('should validate complex locale configurations', () => {
      process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
        defaultLocale: 'en',
        locales: [
          'en',
          'fr',
          'es',
          'de',
          'ja',
          'zh-Hans',
          'zh-Hant',
          'ar',
          'invalid',
        ],
        customMapping: {
          'en-US': { code: 'en' },
          'en-GB': { code: 'en' },
          'fr-FR': { code: 'fr' },
          'fr-CA': { code: 'fr' },
          'es-ES': { code: 'es' },
          'es-MX': { code: 'es' },
        },
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const middleware = createNextMiddleware();

      expect(typeof middleware).toBe('function');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle enterprise-grade configuration', () => {
      process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'fr', 'es', 'de', 'ja', 'zh', 'ar'],
        customMapping: {
          'zh-CN': { code: 'zh-Hans' },
          'zh-TW': { code: 'zh-Hant' },
          'zh-SG': { code: 'zh-Hans' },
        },
        headersAndCookies: {
          localeCookieName: 'enterprise_locale',
          localeHeaderName: 'X-Enterprise-Locale',
          localeRoutingEnabledCookieName: 'enterprise_routing_enabled',
          referrerLocaleCookieName: 'enterprise_referrer_locale',
          resetLocaleCookieName: 'enterprise_reset_locale',
        },
      });

      const pathConfig: PathConfig = {
        '/admin/dashboard': {
          en: '/admin/dashboard',
          fr: '/admin/tableau-de-bord',
          es: '/admin/panel-control',
          de: '/admin/dashboard',
        },
        '/admin/users/[id]/edit': {
          en: '/admin/users/[id]/edit',
          fr: '/admin/utilisateurs/[id]/modifier',
          es: '/admin/usuarios/[id]/editar',
        },
      };

      const middleware = createNextMiddleware({
        localeRouting: true,
        prefixDefaultLocale: true,
        pathConfig,
      });

      expect(typeof middleware).toBe('function');
    });
  });

  describe('Middleware Execution Robustness', () => {
    it('should handle all middleware execution paths without throwing', () => {
      const middleware = createNextMiddleware({
        localeRouting: true,
        prefixDefaultLocale: false,
        pathConfig: {
          '/test': { en: '/test-en', fr: '/test-fr' },
        },
      });

      const testRequests = [
        // Basic paths
        { pathname: '/', description: 'root path' },
        { pathname: '/test', description: 'configured path' },
        { pathname: '/test-en', description: 'English localized path' },
        { pathname: '/test-fr', description: 'French localized path' },
        { pathname: '/unconfigured', description: 'unconfigured path' },

        // With locales in path
        { pathname: '/en/test', description: 'prefixed English' },
        { pathname: '/fr/test', description: 'prefixed French' },
        { pathname: '/es/test', description: 'prefixed Spanish' },

        // Edge cases
        { pathname: '', description: 'empty pathname' },
        { pathname: '//double/slash', description: 'double slash' },
        { pathname: '/path with spaces', description: 'spaces in path' },
        { pathname: '/path%20with%20encoding', description: 'encoded path' },
      ];

      testRequests.forEach(({ pathname, description }) => {
        const req = {
          nextUrl: { pathname },
          headers: new Headers(),
          cookies: { get: vi.fn(() => undefined) },
        } as any;

        expect(() => {
          const result = middleware(req);
          expect(result, description).toBeDefined();
        }, description).not.toThrow();
      });
    });

    it('should handle source map requests correctly', () => {
      const middleware = createNextMiddleware({ ignoreSourceMaps: true });

      const sourcemapPaths = [
        '/__nextjs_source-map/main.js',
        '/__nextjs_source-map/pages/index.js',
        '/__nextjs_source-map/_app.js.map',
      ];

      sourcemapPaths.forEach((pathname) => {
        const req = {
          nextUrl: { pathname },
          headers: new Headers(),
          cookies: { get: vi.fn() },
        } as any;

        const result = middleware(req);
        expect(result, `Source map: ${pathname}`).toBeDefined();
      });
    });

    it('should handle edge case inputs gracefully', () => {
      const middleware = createNextMiddleware();

      const edgeCaseInputs = [
        {
          nextUrl: { pathname: '' },
          headers: new Headers(),
          cookies: { get: vi.fn() },
        },
        {
          nextUrl: { pathname: '//double-slash' },
          headers: new Headers(),
          cookies: { get: vi.fn() },
        },
        {
          nextUrl: { pathname: '/normal' },
          headers: new Headers(),
          cookies: { get: vi.fn(() => null) },
        },
        {
          nextUrl: { pathname: '/normal' },
          headers: new Headers(),
          cookies: { get: vi.fn(() => ({})) },
        },
      ];

      edgeCaseInputs.forEach((req, index) => {
        expect(() => {
          const result = middleware(req as any);
          expect(result).toBeDefined();
        }, `Edge case input scenario ${index}`).not.toThrow();
      });
    });
  });

  describe('Configuration Validation and Error Handling', () => {
    it('should handle missing required environment variables gracefully', () => {
      delete process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
      delete process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED;

      expect(() => createNextMiddleware()).not.toThrow();
    });

    it('should handle malformed JSON configuration', () => {
      const malformedConfigs = [
        'not-json',
        '{"incomplete":',
        '{"defaultLocale":}',
        '[]',
        'null',
        '{"defaultLocale":"","locales":[]}',
      ];

      malformedConfigs.forEach((config, index) => {
        process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = config;
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        expect(() => {
          createNextMiddleware();
        }, `Malformed config ${index}: ${config}`).not.toThrow();

        consoleSpy.mockRestore();
      });
    });

    it('should validate path configuration structure', () => {
      const pathConfigurations = [
        {}, // Empty
        { '/simple': '/simple-localized' },
        { '/complex': { en: '/en-complex', fr: '/fr-complex' } },
        { '/mixed': '/string-config', '/other': { en: '/object-config' } },
        // Test with potential problematic keys
        { '': '/empty-key' },
        { '/': '/root' },
        { '/very/long/path/with/many/segments': '/localized' },
      ];

      pathConfigurations.forEach((pathConfig, index) => {
        expect(() => {
          createNextMiddleware({ pathConfig: pathConfig as PathConfig });
        }, `Path config ${index}`).not.toThrow();
      });
    });
  });

  describe('Integration with GT Services', () => {
    it('should handle GT services configuration variations', () => {
      const gtServiceConfigs = [
        { enabled: 'false', expectThrow: false },
        { enabled: 'true', expectThrow: false },
        { enabled: '', expectThrow: false },
        { enabled: 'invalid', expectThrow: false },
      ];

      gtServiceConfigs.forEach(({ enabled, expectThrow }) => {
        process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED = enabled;

        if (expectThrow) {
          expect(() => createNextMiddleware()).toThrow();
        } else {
          expect(() => createNextMiddleware()).not.toThrow();
        }
      });
    });

    it('should handle complex custom mapping scenarios', () => {
      process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'fr', 'es'],
        customMapping: {
          // Regional variants
          'en-US': { code: 'en' },
          'en-GB': { code: 'en' },
          'en-AU': { code: 'en' },
          'en-CA': { code: 'en' },
          'fr-FR': { code: 'fr' },
          'fr-CA': { code: 'fr' },
          'fr-BE': { code: 'fr' },
          'es-ES': { code: 'es' },
          'es-MX': { code: 'es' },
          'es-AR': { code: 'es' },
          // Script variants
          'zh-Hans': { code: 'zh' },
          'zh-Hant': { code: 'zh' },
          'sr-Latn': { code: 'sr' },
          'sr-Cyrl': { code: 'sr' },
        },
      });

      expect(() => createNextMiddleware()).not.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    it('should create middleware quickly even with large configurations', () => {
      // Generate a large path configuration
      const largePathConfig: PathConfig = {};

      for (let i = 0; i < 5000; i++) {
        largePathConfig[`/path-${i}`] = {
          en: `/en-path-${i}`,
          fr: `/fr-path-${i}`,
          es: `/es-path-${i}`,
          de: `/de-path-${i}`,
        };
      }

      const startTime = Date.now();
      const middleware = createNextMiddleware({
        pathConfig: largePathConfig,
        localeRouting: true,
      });
      const creationTime = Date.now() - startTime;

      expect(typeof middleware).toBe('function');
      expect(creationTime).toBeLessThan(10000); // Should create in reasonable time
    });

    it('should handle middleware execution under load', () => {
      const middleware = createNextMiddleware({
        pathConfig: {
          '/high-traffic': { en: '/high-traffic', fr: '/trafic-eleve' },
        },
      });

      // Test with many different request patterns
      const requestPatterns = [
        { pathname: '/high-traffic', locale: 'en' },
        { pathname: '/trafic-eleve', locale: 'fr' },
        { pathname: '/unknown-path', locale: 'es' },
        { pathname: '/', locale: 'de' },
      ];

      // Execute many requests
      for (let i = 0; i < 1000; i++) {
        const pattern = requestPatterns[i % requestPatterns.length];
        const req = {
          nextUrl: { pathname: pattern.pathname },
          headers: new Headers(),
          cookies: {
            get: vi.fn(() =>
              pattern.locale ? { value: pattern.locale } : undefined
            ),
          },
        } as any;

        expect(() => {
          const result = middleware(req);
          expect(result).toBeDefined();
        }, `Request ${i}: ${pattern.pathname} (${pattern.locale})`).not.toThrow();
      }
    });
  });

  describe('Real-world Integration Scenarios', () => {
    it('should support multi-brand e-commerce platform', () => {
      const multiBrandConfig: PathConfig = {
        // Brand A paths
        '/brand-a': { en: '/brand-a', fr: '/marque-a', es: '/marca-a' },
        '/brand-a/products/[id]': {
          en: '/brand-a/products/[id]',
          fr: '/marque-a/produits/[id]',
        },

        // Brand B paths
        '/brand-b': { en: '/brand-b', fr: '/marque-b' },
        '/brand-b/catalog/[category]/[item]': {
          en: '/brand-b/catalog/[category]/[item]',
          fr: '/marque-b/catalogue/[category]/[item]',
        },

        // Shared services
        '/checkout': { en: '/checkout', fr: '/commande', es: '/pago' },
        '/support': { en: '/support', fr: '/assistance', es: '/soporte' },
      };

      const middleware = createNextMiddleware({
        pathConfig: multiBrandConfig,
        localeRouting: true,
        prefixDefaultLocale: false,
      });

      expect(typeof middleware).toBe('function');
    });

    it('should support SaaS multi-tenant architecture', () => {
      const saasConfig: PathConfig = {
        // Public marketing pages
        '/': { en: '/', fr: '/', es: '/' },
        '/pricing': { en: '/pricing', fr: '/tarifs', es: '/precios' },
        '/features': {
          en: '/features',
          fr: '/fonctionnalites',
          es: '/caracteristicas',
        },

        // Tenant-specific dashboards
        '/app/[tenantId]/dashboard': {
          en: '/app/[tenantId]/dashboard',
          fr: '/app/[tenantId]/tableau-de-bord',
          es: '/app/[tenantId]/panel-control',
        },
        '/app/[tenantId]/users': {
          en: '/app/[tenantId]/users',
          fr: '/app/[tenantId]/utilisateurs',
          es: '/app/[tenantId]/usuarios',
        },
        '/app/[tenantId]/settings/[section]': {
          en: '/app/[tenantId]/settings/[section]',
          fr: '/app/[tenantId]/parametres/[section]',
        },

        // User profile across tenants
        '/profile/[userId]': {
          en: '/profile/[userId]',
          fr: '/profil/[userId]',
          es: '/perfil/[userId]',
        },
      };

      const middleware = createNextMiddleware({
        pathConfig: saasConfig,
        localeRouting: true,
        prefixDefaultLocale: true, // SaaS might want explicit locale prefixes
      });

      expect(typeof middleware).toBe('function');
    });
  });

  describe('Stress Testing and Edge Cases', () => {
    it('should handle pathological input combinations', () => {
      const middleware = createNextMiddleware({
        pathConfig: {
          '/normal': '/normal-localized',
          '/[param]': { en: '/[param]', fr: '/[param]-fr' },
        },
      });

      const pathologicalInputs = [
        // Extremely long paths
        '/' + 'a'.repeat(10000),
        // Many segments
        '/' + Array(1000).fill('segment').join('/'),
        // Special characters
        '/test%20with%20spaces',
        '/test/with/unicode/字符',
        '/test/with/emoji/🚀',
        // Empty or minimal
        '',
        '/',
        '//',
      ];

      pathologicalInputs.forEach((pathname, index) => {
        const req = {
          nextUrl: { pathname },
          headers: new Headers(),
          cookies: { get: vi.fn() },
        } as any;

        expect(
          () => {
            const result = middleware(req);
            // Should either succeed or fail gracefully
          },
          `Pathological input ${index}: ${pathname.substring(0, 50)}...`
        ).not.toThrow();
      });
    });

    it('should maintain consistent behavior across request variations', () => {
      const middleware = createNextMiddleware({
        localeRouting: true,
        pathConfig: {
          '/consistent': { en: '/consistent', fr: '/coherent' },
        },
      });

      // Test same logical request with different cookie combinations
      const cookieVariations = [
        {},
        { 'gt-locale': 'fr' },
        { 'gt-locale': 'fr', 'gt-referrer-locale': 'es' },
        { 'gt-locale': 'fr', 'gt-reset-locale': 'true' },
        { 'gt-referrer-locale': 'de' },
        { 'gt-locale': 'invalid-locale' },
      ];

      cookieVariations.forEach((cookies, index) => {
        const req = {
          nextUrl: { pathname: '/consistent' },
          headers: new Headers(),
          cookies: {
            get: vi.fn((name) =>
              cookies[name as keyof typeof cookies]
                ? { value: cookies[name as keyof typeof cookies] }
                : undefined
            ),
          },
        } as any;

        const result = middleware(req);
        expect(result, `Cookie variation ${index}`).toBeDefined();
        expect(
          typeof result,
          `Cookie variation ${index} should return object`
        ).toBe('object');
      });
    });
  });

  describe('Comprehensive Environment Testing', () => {
    it('should work across different environment configurations', () => {
      const environmentScenarios = [
        {
          name: 'minimal production',
          env: {
            _GENERALTRANSLATION_I18N_CONFIG_PARAMS: JSON.stringify({
              defaultLocale: 'en',
              locales: ['en'],
            }),
          },
        },
        {
          name: 'full development',
          env: {
            _GENERALTRANSLATION_I18N_CONFIG_PARAMS: JSON.stringify({
              defaultLocale: 'en',
              locales: ['en', 'fr', 'es', 'de', 'ja'],
              customMapping: { 'en-US': { code: 'en' } },
              headersAndCookies: {
                localeCookieName: 'dev-locale',
                localeHeaderName: 'x-dev-locale',
              },
            }),
            _GENERALTRANSLATION_GT_SERVICES_ENABLED: 'true',
            _GENERALTRANSLATION_IGNORE_BROWSER_LOCALES: 'false',
          },
        },
        {
          name: 'enterprise staging',
          env: {
            _GENERALTRANSLATION_I18N_CONFIG_PARAMS: JSON.stringify({
              defaultLocale: 'en',
              locales: ['en', 'fr', 'es', 'de', 'ja', 'zh', 'ar'],
              customMapping: {},
              headersAndCookies: {
                localeCookieName: 'enterprise_locale',
                localeHeaderName: 'X-Enterprise-Locale',
              },
            }),
            _GENERALTRANSLATION_GT_SERVICES_ENABLED: 'true',
          },
        },
      ];

      environmentScenarios.forEach(({ name, env }) => {
        // Set environment
        Object.entries(env).forEach(([key, value]) => {
          process.env[key] = value;
        });

        expect(() => {
          const middleware = createNextMiddleware();
          expect(typeof middleware, name).toBe('function');
        }, name).not.toThrow();
      });
    });
  });
});
