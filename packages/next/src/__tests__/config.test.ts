import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from 'vitest';
import type { MockInstance } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { NextConfig } from 'next';
import { BABEL_PLUGIN_SUPPORT } from '../plugin/constants';
import { nextLocaleCookieName } from '../utils/cookies';

// ---- Mocks ---- //

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '{}'),
  },
}));

const mockVersionInfo = vi.hoisted(() => ({
  rootParamStability: 'experimental',
  turboConfigStable: true,
  localeRefreshSupported: true,
  swcPluginCompatible: true,
  babelPluginCompatible: true,
}));

vi.mock('../plugin/getStableNextVersionInfo', () => mockVersionInfo);

// The default render settings are derived from NODE_ENV when the config
// module loads, so it is imported once the development env is in place.
let withGTConfig: typeof import('../config').withGTConfig;

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'development');
  ({ withGTConfig } = await import('../config'));
});

// ---- Helpers ---- //

type GTProps = NonNullable<Parameters<typeof withGTConfig>[1]>;
type WebpackConfigArg = Parameters<NonNullable<NextConfig['webpack']>>[0];
type WebpackOptions = Parameters<NonNullable<NextConfig['webpack']>>[1];
// Mirrors webpack condition semantics: string = path prefix, RegExp = test,
// array = any-of.
type Condition = string | RegExp | Condition[];
type Rule = { test: Condition; include?: Condition; type: string };
type WebpackConfig = {
  context: string;
  resolve: { alias: Record<string, unknown> };
  plugins: unknown[];
  cache: boolean;
  module?: { rules?: Rule[] };
};

const CONFLICT = /[Cc]onflicting configuration/;
const I18N_MISMATCH =
  'Next.js internationalized routing does not match the GT config file';
const LOAD_TRANSLATIONS = './loadTranslations.ts';

let warn: MockInstance<typeof console.warn>;

/** Runs withGTConfig() on an object config and returns its env block. */
function buildEnv(props?: GTProps, nextConfig: NextConfig = {}) {
  return withGTConfig(nextConfig, props).env!;
}

/** Runs withGTConfig() and parses the serialized server config params. */
function buildParams(props?: GTProps, nextConfig: NextConfig = {}) {
  return JSON.parse(
    buildEnv(props, nextConfig)._GENERALTRANSLATION_I18N_CONFIG_PARAMS!
  );
}

/** Makes exactly these paths exist, as given (not resolved). */
function mockExistingPaths(...paths: string[]) {
  vi.mocked(fs.existsSync).mockImplementation((p) => paths.includes(String(p)));
}

/** Makes exactly these project-relative files exist at their resolved path. */
function mockExistingFiles(...files: string[]) {
  mockExistingPaths(...files.map((file) => path.resolve(file)));
}

/** Provides a GT config file with the given contents. */
function mockConfigFile(config: object | string, at = './gt.config.json') {
  mockExistingPaths(at);
  vi.mocked(fs.readFileSync).mockReturnValue(
    typeof config === 'string' ? config : JSON.stringify(config)
  );
}

function stubCredentials(env: Record<string, string>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
}

function runWebpack(
  result: NextConfig,
  options: Partial<WebpackOptions> = { isServer: true }
) {
  const config: WebpackConfig = {
    context: '/fake/project',
    resolve: { alias: {} },
    plugins: [],
    cache: true,
  };
  const returned = result.webpack!(
    config as WebpackConfigArg,
    options as WebpackOptions
  );
  return { config, returned };
}

function findAutoRule(config: WebpackConfig) {
  return (config.module?.rules ?? []).find((r) => r.type === 'javascript/auto');
}

function conditionMatches(cond: Condition, p: string): boolean {
  return typeof cond === 'string'
    ? p.startsWith(cond)
    : Array.isArray(cond)
      ? cond.some((c) => conditionMatches(c, p))
      : cond.test(p);
}

function ruleAppliesTo(rule: Rule, p: string) {
  return (
    conditionMatches(rule.test, p) &&
    (!rule.include || conditionMatches(rule.include, p))
  );
}

// ---- Setup ---- //

beforeEach(() => {
  for (const name of [
    'GT_PROJECT_ID',
    'GT_API_KEY',
    'GT_DEV_API_KEY',
    'NEXT_PUBLIC_GT_PROJECT_ID',
    'NEXT_PUBLIC_GT_DEV_API_KEY',
    'TURBOPACK',
  ]) {
    vi.stubEnv(name, undefined);
  }
  vi.stubEnv('NODE_ENV', 'development');
  Object.assign(mockVersionInfo, {
    rootParamStability: 'experimental',
    turboConfigStable: true,
    localeRefreshSupported: true,
    swcPluginCompatible: true,
    babelPluginCompatible: true,
  });
  // Restores the fs mocks to "no files exist".
  vi.resetAllMocks();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// ---- Tests ---- //

describe('withGTConfig', () => {
  describe('defaults', () => {
    it.each([undefined, {}])('layers GT onto nextConfig %j', (nextConfig) => {
      const result = withGTConfig(nextConfig);

      expect(result).toHaveProperty('env');
      expect(result.webpack).toBeTypeOf('function');
      expect(result.experimental!.swcPlugins).toEqual([]);
    });

    it('serializes the library defaults into the config params', () => {
      expect(buildParams()).toMatchObject({
        _usingPlugin: true,
        defaultLocale: 'en',
        loadDictionaryEnabled: false,
        loadTranslationsType: 'remote',
        maxConcurrentRequests: 100,
        maxBatchSize: 25,
        batchInterval: 50,
        // Remote translations without a dev API key are cached for a minute.
        cacheExpiryTime: 60000,
        experimentalCompilerOptions: {
          type: 'none',
          logLevel: 'warn',
          compileTimeHash: true,
          disableBuildChecks: false,
        },
        renderSettings: { method: 'default', timeout: 8000 },
        headersAndCookies: {
          localeHeaderName: 'x-generaltranslation-locale',
          localeCookieName: 'generaltranslation.locale',
          enableI18nCookieName: 'generaltranslation.enable-i18n',
          referrerLocaleCookieName: 'generaltranslation.referrer-locale',
          localeRoutingEnabledCookieName:
            'generaltranslation.locale-routing-enabled',
          resetLocaleCookieName: 'generaltranslation.locale-reset',
        },
      });
    });

    it('exposes every flag to Next.js as a string env var', () => {
      const env = buildEnv();

      expect(env).toMatchObject({
        _GENERALTRANSLATION_I18N_CONFIG_PARAMS: expect.any(String),
        _GENERALTRANSLATION_MIDDLEWARE_CONFIG: '{}',
        _GENERALTRANSLATION_DEFAULT_LOCALE: 'en',
        _GENERALTRANSLATION_GT_SERVICES_ENABLED: 'false',
        _GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED: 'false',
        _GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED: 'false',
        _GENERALTRANSLATION_IGNORE_BROWSER_LOCALES: 'false',
        _GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED: expect.any(String),
        _GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED: expect.any(String),
        _GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING: 'false',
      });
      // No dictionary was found, so no dictionary file type is exposed.
      expect(env._GENERALTRANSLATION_DICTIONARY_FILE_TYPE).toBeUndefined();
      for (const [key, value] of Object.entries(env)) {
        if (key.startsWith('_GENERALTRANSLATION_')) {
          expect(value, key).toBeTypeOf('string');
        }
      }
    });

    it.each([false, true])(
      'exports locale refresh support (%s) from the detected Next version',
      (supported) => {
        mockVersionInfo.localeRefreshSupported = supported;

        expect(buildEnv()._GENERALTRANSLATION_LOCALE_REFRESH_SUPPORTED).toBe(
          String(supported)
        );
      }
    );

    it('opts into experimental.rootParams only while root params are experimental', () => {
      expect(withGTConfig().experimental!.rootParams).toBe(true);

      mockVersionInfo.rootParamStability = 'stable';
      expect(withGTConfig().experimental).not.toHaveProperty('rootParams');
    });
  });

  describe('nextConfig passthrough', () => {
    it('preserves existing nextConfig properties and env', () => {
      const result = withGTConfig({
        images: { domains: ['example.com'] },
        reactStrictMode: true,
        compress: false,
        env: { MY_EXISTING_VAR: 'hello' },
      });

      expect(result.images).toEqual({ domains: ['example.com'] });
      expect(result.reactStrictMode).toBe(true);
      expect(result.compress).toBe(false);
      expect(result.env!.MY_EXISTING_VAR).toBe('hello');
      expect(result.env!._GENERALTRANSLATION_I18N_CONFIG_PARAMS).toBeDefined();
    });

    it('adds gt-next to transpilePackages while preserving user packages', () => {
      const result = withGTConfig({
        transpilePackages: ['existing-package', 'gt-next'],
      });

      expect(result.transpilePackages).toEqual(['existing-package', 'gt-next']);
    });

    it.each([
      [
        'a sync',
        (_phase: string): NextConfig => ({ reactStrictMode: true }),
        false,
      ],
      [
        'an async',
        async (_phase: string): Promise<NextConfig> => ({
          reactStrictMode: true,
        }),
        true,
      ],
    ])(
      'layers GT on the result of %s config function',
      async (_, factory, isAsync) => {
        const built = withGTConfig(factory);

        expect(built).toBeTypeOf('function');
        const returned = (
          built as unknown as (
            phase: string,
            context: { defaultConfig: NextConfig }
          ) => NextConfig | Promise<NextConfig>
        )('phase-production-build', { defaultConfig: {} });

        // A sync config function must stay sync: Next reads its result as is.
        expect(returned instanceof Promise).toBe(isAsync);
        const resolved = await returned;
        expect(resolved.reactStrictMode).toBe(true);
        expect(resolved).toHaveProperty('env');
        expect(resolved.webpack).toBeTypeOf('function');
        expect(resolved.transpilePackages).toContain('gt-next');
      }
    );
  });

  describe('Next.js i18n configuration', () => {
    it('preserves the user-owned Next.js i18n configuration unchanged', () => {
      const i18n = {
        locales: ['en', 'fr'],
        defaultLocale: 'en',
        localeDetection: false,
        domains: [{ domain: 'example.fr', defaultLocale: 'fr' }],
      } satisfies NonNullable<NextConfig['i18n']>;

      const result = withGTConfig({ i18n });
      const clientParams = JSON.parse(
        result.env!.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS!
      );

      expect(result.i18n).toBe(i18n);
      expect(
        JSON.parse(result.env!._GENERALTRANSLATION_I18N_CONFIG_PARAMS!)
          .headersAndCookies.localeCookieName
      ).toBe('generaltranslation.locale');
      expect(clientParams.headersAndCookies.localeCookieName).toBe(
        'generaltranslation.locale'
      );
    });

    it.each([
      // Next.js locale detection only reads its own preference cookie.
      { localeDetection: undefined, expected: nextLocaleCookieName },
      { localeDetection: false as const, expected: 'custom-locale' },
    ])(
      'uses the $expected cookie with localeDetection=$localeDetection',
      ({ localeDetection, expected }) => {
        const params = buildParams(
          { headersAndCookies: { localeCookieName: 'custom-locale' } },
          {
            i18n: {
              locales: ['en', 'fr'],
              defaultLocale: 'en',
              localeDetection,
            },
          }
        );

        expect(params.headersAndCookies.localeCookieName).toBe(expected);
      }
    );

    function mismatchWarnings() {
      return warn.mock.calls
        .map(([message]) => String(message))
        .filter((message) => message.includes(I18N_MISMATCH));
    }

    it('warns when the GT locale fields differ from Next.js i18n', () => {
      mockConfigFile({ defaultLocale: 'en', locales: ['en', 'fr'] });

      withGTConfig({ i18n: { defaultLocale: 'es', locales: ['es', 'de'] } });

      expect(mismatchWarnings()).toEqual([
        expect.stringContaining('defaultLocale: GT has "en"; Next.js has "es"'),
      ]);
      expect(mismatchWarnings()[0]).toContain(
        'locales: GT has ["en","fr"]; Next.js has ["es","de"]'
      );
    });

    it('reports the GT locales it compared, including the default locale', () => {
      mockConfigFile({ defaultLocale: 'en', locales: ['fr', 'es'] });

      withGTConfig({ i18n: { defaultLocale: 'en', locales: ['fr', 'es'] } });

      expect(mismatchWarnings()).toEqual([
        expect.stringContaining(
          'locales: GT has ["en","fr","es"]; Next.js has ["fr","es"]'
        ),
      ]);
      expect(mismatchWarnings()[0]).not.toContain('defaultLocale:');
    });

    it.each([
      ['the locale sets match in a different order', ['fr', 'en']],
      ['the GT locale list omits its default locale', ['fr']],
      ['GT normalization removes duplicates', ['fr', 'fr']],
    ])('does not warn when %s', (_, locales) => {
      mockConfigFile({ defaultLocale: 'en', locales });

      withGTConfig({ i18n: { defaultLocale: 'en', locales: ['en', 'fr'] } });

      expect(mismatchWarnings()).toEqual([]);
    });

    it('does not compare locale fields without Next.js i18n', () => {
      mockConfigFile({ defaultLocale: 'en', locales: ['en', 'fr'] });

      withGTConfig();

      expect(mismatchWarnings()).toEqual([]);
    });
  });

  describe('config file loading', () => {
    const candidates = [
      './gt.config.json',
      './.gt/gt.config.json',
      // Legacy location
      './.locadex/gt.config.json',
    ];

    it.each(candidates)('loads %s when it exists', (configPath) => {
      mockConfigFile({ defaultLocale: 'fr' }, configPath);

      expect(buildParams().defaultLocale).toBe('fr');
    });

    it('prefers ./gt.config.json, then .gt/, then .locadex/', () => {
      vi.mocked(fs.readFileSync).mockImplementation((p) =>
        JSON.stringify({ description: String(p) })
      );

      mockExistingPaths(...candidates);
      expect(buildParams().description).toBe(candidates[0]);

      mockExistingPaths(...candidates.slice(1));
      expect(buildParams().description).toBe(candidates[1]);
    });

    it('reads a custom props.config path', () => {
      mockConfigFile({ defaultLocale: 'ko' }, './custom/my-config.json');

      expect(
        buildParams({ config: './custom/my-config.json' }).defaultLocale
      ).toBe('ko');
    });

    it('falls back to the defaults when the config file is invalid JSON', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockConfigFile('not valid json!!!');

      expect(buildParams().defaultLocale).toBe('en');
      expect(error).toHaveBeenCalled();
    });

    it('merges props over the config file over the defaults', () => {
      stubCredentials({ GT_PROJECT_ID: 'env-project-id' });
      mockConfigFile({
        maxBatchSize: 99,
        defaultLocale: 'es',
        locales: ['es', 'en'],
      });

      const params = buildParams({
        defaultLocale: 'es',
        maxConcurrentRequests: 200,
      });

      expect(params).toMatchObject({
        // Config file
        maxBatchSize: 99,
        locales: ['es', 'en'],
        // Props (agreeing with the config file)
        defaultLocale: 'es',
        maxConcurrentRequests: 200,
        // Defaults
        batchInterval: 50,
      });
    });
  });

  describe('conflicts between the config file and props', () => {
    it.each([
      ['primitives', { defaultLocale: 'fr' }, { defaultLocale: 'de' }],
      [
        'arrays of different length',
        { locales: ['en', 'fr'] },
        { locales: ['en'] },
      ],
      [
        'arrays with different values',
        { locales: ['en', 'fr'] },
        { locales: ['en', 'de'] },
      ],
      [
        'objects',
        { renderSettings: { method: 'skeleton', timeout: 5000 } },
        { renderSettings: { method: 'default', timeout: 5000 } },
      ],
      [
        'null against a value',
        { runtimeUrl: null },
        { runtimeUrl: 'https://custom.example.com' },
      ],
    ] as [string, object, GTProps][])(
      'throws for differing %s',
      (_, fileConfig, props) => {
        mockConfigFile(fileConfig);

        expect(() => withGTConfig({}, props)).toThrow(CONFLICT);
      }
    );

    it.each([
      [
        'identical primitives',
        { defaultLocale: 'en' },
        { defaultLocale: 'en' },
      ],
      [
        'identical arrays',
        { locales: ['en', 'fr'] },
        { locales: ['en', 'fr'] },
      ],
      [
        'identical objects',
        { renderSettings: { method: 'default', timeout: 5000 } },
        { renderSettings: { method: 'default', timeout: 5000 } },
      ],
      [
        'keys only in the config file',
        { maxBatchSize: 99 },
        { defaultLocale: 'en' },
      ],
    ] as [string, object, GTProps][])(
      'does not throw for %s',
      (_, fileConfig, props) => {
        mockConfigFile(fileConfig);

        expect(() => withGTConfig({}, props)).not.toThrow();
      }
    );

    it('names the key and both values in the error', () => {
      mockConfigFile({ defaultLocale: 'fr' });

      expect(() => withGTConfig({}, { defaultLocale: 'de' })).toThrow(
        '- Key: defaultLocale Next Config: "de" does not match GT Config: "fr"'
      );
    });
  });

  describe('credentials and GT services', () => {
    const devKeys = {
      GT_PROJECT_ID: 'proj',
      GT_API_KEY: 'gtx-development-key',
    };

    it.each([
      {
        name: 'a project and API key in development',
        env: devKeys,
        enabled: 'true',
      },
      {
        name: 'a project and API key in production',
        env: { ...devKeys, NODE_ENV: 'production' },
        enabled: 'true',
      },
      {
        name: 'credentials passed as props',
        props: {
          projectId: 'project-id',
          apiKey: 'api-key',
          devApiKey: 'dev-key',
        },
        enabled: 'true',
      },
      {
        name: 'a project ID in both the env and the config file',
        env: { GT_PROJECT_ID: 'env-project-id' },
        fileConfig: { projectId: 'config-project-id' },
        enabled: 'false',
      },
      {
        // The remote cache alone does not enable services.
        name: 'a project ID without an API key',
        env: { GT_PROJECT_ID: 'proj' },
        enabled: 'false',
      },
      {
        name: 'an API key without a project ID',
        env: { GT_API_KEY: 'api-key-value' },
        enabled: 'false',
      },
      {
        name: 'a custom runtime URL without a cache URL',
        env: { GT_PROJECT_ID: 'proj' },
        props: {
          runtimeUrl: 'https://custom-runtime.example.com',
          cacheUrl: null,
        },
        enabled: 'false',
      },
    ] as {
      name: string;
      env?: Record<string, string>;
      props?: GTProps;
      fileConfig?: object;
      enabled: string;
    }[])(
      'never serializes credentials for $name (services enabled: $enabled)',
      ({ env = {}, props, fileConfig, enabled }) => {
        stubCredentials(env);
        if (fileConfig) mockConfigFile(fileConfig);

        const result = buildEnv(props);
        const params = JSON.parse(
          result._GENERALTRANSLATION_I18N_CONFIG_PARAMS!
        );

        expect(params.projectId).toBeUndefined();
        expect(params.apiKey).toBeUndefined();
        expect(params.devApiKey).toBeUndefined();
        expect(result._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe(enabled);
      }
    );

    it('exposes GT_PROJECT_ID and GT_API_KEY to client code for development hot reload', () => {
      stubCredentials(devKeys);

      expect(buildEnv()).toMatchObject(devKeys);
      // Hot reload is off without a runtime URL.
      expect(buildEnv({ runtimeUrl: null })).not.toHaveProperty('GT_API_KEY');
    });

    it.each<Record<string, string>>([{ GT_API_KEY: 'gtx-secret-key' }])(
      'never exposes %j to client code in production builds',
      (key) => {
        stubCredentials({
          NODE_ENV: 'production',
          GT_PROJECT_ID: 'proj',
          ...key,
        });

        expect(JSON.stringify(buildEnv())).not.toContain('gtx-secret-key');
      }
    );

    it('limits client config params to runtime fields', () => {
      vi.mocked(fs.existsSync).mockImplementation((filepath) =>
        String(filepath).endsWith('server-only-loader.ts')
      );

      const env = buildEnv({
        description: 'server-only description',
        loadTranslationsPath: './server-only-loader.ts',
        customMetadata: 'server-only metadata',
        cacheExpiryTime: 12345,
        timeZone: 'Asia/Tokyo',
        localeMatcher: 'lookup',
        _versionId: 'version-id',
        _disableDevHotReload: true,
      });

      expect(
        JSON.parse(env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS!)
      ).toEqual({
        defaultLocale: expect.any(String),
        locales: expect.any(Array),
        localeMatcher: 'lookup',
        runtimeUrl: expect.any(String),
        cacheUrl: expect.any(String),
        cacheExpiryTime: 12345,
        timeZone: 'Asia/Tokyo',
        maxConcurrentRequests: expect.any(Number),
        maxBatchSize: expect.any(Number),
        batchInterval: expect.any(Number),
        renderSettings: { timeout: expect.any(Number) },
        headersAndCookies: {
          localeCookieName: expect.any(String),
          enableI18nCookieName: expect.any(String),
        },
        _versionId: 'version-id',
        _disableDevHotReload: true,
      });
    });
  });

  describe('locales', () => {
    it.each([
      [
        ['fr', 'de'],
        ['en', 'fr', 'de'],
      ],
      [
        ['en', 'fr', 'en'],
        ['en', 'fr'],
      ],
      [[], ['en']],
    ])('normalizes locales %j to %j', (locales, expected) => {
      expect(buildParams({ defaultLocale: 'en', locales }).locales).toEqual(
        expected
      );
    });

    // Runtime identities retain the same spelling as routes and local files.
    it.each([false, true])(
      'preserves configured locale spellings (GT services: %s)',
      (services) => {
        if (services) {
          stubCredentials({ GT_PROJECT_ID: 'proj', GT_API_KEY: 'gt-dev-abc' });
        }

        const env = buildEnv({
          defaultLocale: 'en',
          locales: ['en-us', 'fr-fr'],
        });

        expect(env._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe(
          String(services)
        );
        expect(
          JSON.parse(env._GENERALTRANSLATION_I18N_CONFIG_PARAMS!).locales
        ).toEqual(['en', 'en-us', 'fr-fr']);
      }
    );

    it('rejects invalid locales only when GT services are enabled', () => {
      const props = { defaultLocale: 'en', locales: ['not-a-real-locale-xyz'] };

      expect(() => withGTConfig({}, props)).not.toThrow();

      stubCredentials({ GT_PROJECT_ID: 'proj', GT_API_KEY: 'gt-dev-abc' });
      expect(() => withGTConfig({}, props)).toThrow(/invalid locale/i);
    });

    it('sets the invalid locale warning flag from props', () => {
      expect(
        buildEnv({ disableInvalidLocaleWarning: true })
          ._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING
      ).toBe('true');
    });
  });

  describe('dictionary resolution', () => {
    it.each(['.json', '.ts', '.js'])(
      'reports the file type of a props.dictionary ending in %s',
      (extension) => {
        expect(
          buildEnv({ dictionary: `./my-dict${extension}` })
            ._GENERALTRANSLATION_DICTIONARY_FILE_TYPE
        ).toBe(extension);
      }
    );

    it.each([
      ['./dictionary.ts', '.ts'],
      // Falls back to [defaultLocale].json
      ['./en.json', '.json'],
    ])('finds %s without props.dictionary', (file, extension) => {
      mockExistingFiles(file);

      expect(buildEnv()._GENERALTRANSLATION_DICTIONARY_FILE_TYPE).toBe(
        extension
      );
    });
  });

  describe('custom loaders', () => {
    const loaders = [
      {
        name: 'loadDictionary',
        prop: 'loadDictionaryPath',
        flag: '_GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED',
      },
      {
        name: 'loadTranslations',
        prop: 'loadTranslationsPath',
        flag: '_GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED',
      },
    ] as const;

    it.each(loaders)(
      'enables a $name file given as $prop',
      ({ name, prop, flag }) => {
        mockExistingFiles(`./custom/${name}.ts`);

        expect(buildEnv({ [prop]: `./custom/${name}.ts` })[flag]).toBe('true');
      }
    );

    it.each(loaders)('finds ./$name.ts without $prop', ({ name, flag }) => {
      mockExistingFiles(`./${name}.ts`);

      expect(buildEnv()[flag]).toBe('true');
    });

    it.each(loaders)('throws when $prop does not exist', ({ name, prop }) => {
      expect(() =>
        withGTConfig({}, { [prop]: `./missing/${name}.ts` })
      ).toThrow(new RegExp(`${name}.*could not be resolved`, 'i'));
    });
  });

  describe('cache expiry', () => {
    it('is not defaulted with a development API key', () => {
      stubCredentials({ GT_API_KEY: 'gt-dev-abc' });

      expect(buildParams().cacheExpiryTime).toBeUndefined();
    });

    it('keeps an explicit cacheExpiryTime', () => {
      expect(buildParams({ cacheExpiryTime: 30000 }).cacheExpiryTime).toBe(
        30000
      );
    });

    it('is not defaulted with a custom loadTranslations', () => {
      mockExistingFiles(LOAD_TRANSLATIONS);

      expect(
        buildParams({ loadTranslationsPath: LOAD_TRANSLATIONS }).cacheExpiryTime
      ).toBeUndefined();
    });
  });

  describe('cacheComponents', () => {
    it('disables caching and dev hot reload, overriding cacheExpiryTime', () => {
      mockExistingFiles(LOAD_TRANSLATIONS);

      expect(
        buildParams(
          { cacheExpiryTime: 30000, loadTranslationsPath: LOAD_TRANSLATIONS },
          { cacheComponents: true }
        )
      ).toMatchObject({
        cacheExpiryTime: 0,
        _cacheComponentsEnabled: true,
        _disableDevHotReload: true,
      });
    });

    it('warns when it disables active dev hot reload translation', () => {
      stubCredentials({ GT_PROJECT_ID: 'project-id', GT_API_KEY: 'dev-key' });
      mockExistingFiles(LOAD_TRANSLATIONS);

      const params = buildParams(
        {
          loadTranslationsPath: LOAD_TRANSLATIONS,
          getLocalePath: './getLocale.ts',
          getRegionPath: './getRegion.ts',
        },
        { cacheComponents: true }
      );

      expect(params._disableDevHotReload).toBe(true);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'development runtime translation hot reload has been disabled'
        )
      );
    });

    it('requires a custom loadTranslations', () => {
      expect(() => withGTConfig({ cacheComponents: true })).toThrow(
        /custom loadTranslations\(\) is not configured/
      );
    });
  });

  describe('middleware and routing options', () => {
    it('exposes pathRegex to middleware and client code', () => {
      const pathRegex = '^/(?!uk(?:/|$)).*';

      expect(buildEnv({ pathRegex })._GENERALTRANSLATION_PATH_REGEX).toBe(
        pathRegex
      );
    });

    it('throws a descriptive error for an invalid pathRegex', () => {
      expect(() => withGTConfig({}, { pathRegex: '[unclosed' })).toThrowError(
        'gt-next Error: pathRegex "[unclosed" is not a valid regular expression.'
      );
    });

    it('exposes middleware options to createNextMiddleware separately', () => {
      const pathConfig = { '/about': { fr: '/a-propos' } };

      const env = buildEnv({
        prefixDefaultLocale: true,
        enableSmartRouting: undefined,
        pathConfig,
      });

      expect(JSON.parse(env._GENERALTRANSLATION_MIDDLEWARE_CONFIG!)).toEqual({
        prefixDefaultLocale: true,
        pathConfig,
      });
      const i18nConfig = JSON.parse(
        env._GENERALTRANSLATION_I18N_CONFIG_PARAMS!
      );
      expect(i18nConfig).not.toHaveProperty('prefixDefaultLocale');
      expect(i18nConfig).not.toHaveProperty('pathConfig');
    });

    it('merges headersAndCookies overrides with the defaults', () => {
      const customNames = {
        localeHeaderName: 'x-my-locale',
        localeCookieName: 'my-locale',
        referrerLocaleCookieName: 'my-referrer',
        localeRoutingEnabledCookieName: 'my-routing',
        resetLocaleCookieName: 'my-reset',
      };

      expect(
        buildParams({ headersAndCookies: { localeCookieName: 'my-locale' } })
          .headersAndCookies
      ).toMatchObject({
        localeCookieName: 'my-locale',
        localeHeaderName: 'x-generaltranslation-locale',
      });
      expect(
        buildParams({ headersAndCookies: customNames }).headersAndCookies
      ).toMatchObject(customNames);
    });
  });

  describe('compiler configuration', () => {
    it.each(['none', 'swc'] as const)(
      'warns when automatic JSX injection is used with the %s compiler',
      (type) => {
        withGTConfig(
          {},
          {
            experimentalCompilerOptions: { type, enableAutoJsxInjection: true },
          }
        );

        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'Automatic JSX injection requires the GT webpack compiler'
          )
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "Set experimentalCompilerOptions.type to 'babel'"
          )
        );
      }
    );

    const turbopackWarning =
      'The GT babel compiler is not compatible with Turbopack';
    const reactWarning = `The GT babel compiler requires react@${BABEL_PLUGIN_SUPPORT} or newer`;

    it.each([
      { turbopack: true, oldReact: false },
      { turbopack: false, oldReact: true },
      { turbopack: true, oldReact: true },
    ])(
      'falls back from the babel compiler with a specific warning (Turbopack: $turbopack, old React: $oldReact)',
      ({ turbopack, oldReact }) => {
        if (turbopack) vi.stubEnv('TURBOPACK', '1');
        mockVersionInfo.babelPluginCompatible = !oldReact;

        const params = buildParams({
          experimentalCompilerOptions: { type: 'babel' },
        });

        expect(params.experimentalCompilerOptions.type).toBe('none');
        const warned = (text: string) =>
          warn.mock.calls.some(([message]) => String(message).includes(text));
        expect(warned(turbopackWarning)).toBe(turbopack);
        expect(warned(reactWarning)).toBe(oldReact);
        expect(warned('compatible with turbopack or < react')).toBe(false);
      }
    );

    it('explains how to keep automatic JSX injection under Turbopack', () => {
      vi.stubEnv('TURBOPACK', '1');

      withGTConfig(
        {},
        {
          experimentalCompilerOptions: {
            type: 'babel',
            enableAutoJsxInjection: true,
          },
        }
      );

      for (const text of [
        turbopackWarning,
        "experimentalCompilerOptions: { type: 'swc' }",
        'Automatic JSX injection requires the GT webpack compiler',
        'build with webpack',
      ]) {
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(text));
      }
    });
  });

  describe('webpack', () => {
    const dictionary = { dictionary: './my-dict.json' };

    it('passes automatic JSX injection to the webpack compiler', () => {
      const compiler = require('@generaltranslation/compiler');
      const compilerWebpack = vi.spyOn(compiler, 'webpack').mockReturnValue({});
      const result = withGTConfig(
        {},
        {
          experimentalCompilerOptions: {
            type: 'babel',
            enableAutoJsxInjection: true,
          },
        }
      );

      runWebpack(result);

      expect(compilerWebpack).toHaveBeenCalledWith(
        expect.objectContaining({
          enableAutoJsxInjection: true,
          autoJsxImportSource: 'gt-next',
        })
      );
    });

    it('returns the config from the original nextConfig.webpack', () => {
      const originalWebpack = vi.fn((config: object) => ({
        ...config,
        customProp: true,
      }));

      const { returned } = runWebpack(
        withGTConfig({ webpack: originalWebpack })
      );

      expect(originalWebpack).toHaveBeenCalled();
      expect(returned).toMatchObject({ customProp: true, resolve: {} });
    });

    it('disables webpackConfig.cache in development', () => {
      expect(runWebpack(withGTConfig()).config.cache).toBe(false);
    });

    it('aliases the dictionary unless Turbopack resolves it', () => {
      expect(
        runWebpack(withGTConfig({}, dictionary)).config.resolve.alias
      ).toHaveProperty('gt-next/internal/_dictionary');

      vi.stubEnv('TURBOPACK', '1');
      expect(
        runWebpack(withGTConfig({}, dictionary)).config.resolve.alias
      ).not.toHaveProperty('gt-next/internal/_dictionary');
    });

    it('parses gt-next ESM dist as javascript/auto when a file alias is set', () => {
      // The module dir only counts as gt-next's dist when its sentinel files
      // exist beside the compiled config (config.mjs, internal/_dictionary.mjs)
      vi.mocked(fs.existsSync).mockImplementation(
        (p) =>
          String(p).endsWith('config.mjs') ||
          String(p).endsWith(path.join('internal', '_dictionary.mjs'))
      );

      const rule = findAutoRule(
        runWebpack(withGTConfig({}, dictionary)).config
      )!;

      // app-local, hoisted-root, and pnpm-store installs
      expect(
        ruleAppliesTo(rule, '/app/node_modules/gt-next/dist/index.server.mjs')
      ).toBe(true);
      expect(
        ruleAppliesTo(
          rule,
          '/repo/node_modules/.pnpm/gt-next@1.0.0/node_modules/gt-next/dist/index.server.mjs'
        )
      ).toBe(true);
      // symlinked install (workspace:*, file:) — real path has no node_modules
      // segment; matched via this package's own dist dir (__dirname of config)
      const moduleDir = path.resolve(__dirname, '..');
      expect(
        ruleAppliesTo(rule, path.join(moduleDir, 'index.server.mjs'))
      ).toBe(true);
      // prefix collisions with sibling dirs never match
      expect(ruleAppliesTo(rule, `${moduleDir}-other/index.server.mjs`)).toBe(
        false
      );
      // never CJS dist, never other packages
      expect(
        ruleAppliesTo(rule, '/app/node_modules/gt-next/dist/index.server.js')
      ).toBe(false);
      expect(
        ruleAppliesTo(rule, '/app/node_modules/other/dist/index.mjs')
      ).toBe(false);
    });

    it('does not widen the javascript/auto rule beyond node_modules when the module dir is not gt-next dist', () => {
      // No files exist, so the sentinel check fails, as it would if a bundler
      // had inlined the config somewhere else. Only the node_modules pattern
      // may remain — a dir prefix here could sweep every .mjs under the
      // bundle output into javascript/auto.
      const rule = findAutoRule(
        runWebpack(withGTConfig({}, dictionary)).config
      )!;

      const includes = Array.isArray(rule.include)
        ? rule.include
        : [rule.include];
      expect(includes.every((c) => c instanceof RegExp)).toBe(true);
      expect(
        ruleAppliesTo(rule, path.resolve(__dirname, '..', 'some.mjs'))
      ).toBe(false);
    });

    it('adds the javascript/auto rule when only a request-function alias is set', () => {
      // No dictionary or loader options: the request-function alias alone
      // must enable the rule, keeping the guard in lockstep with the alias
      // block (see config.ts).
      const { config } = runWebpack(
        withGTConfig({}, { getLocalePath: './my-get-locale.ts' })
      );

      expect(config.resolve.alias).toHaveProperty(
        'gt-next/internal/_getLocale'
      );
      expect(findAutoRule(config)).toBeDefined();
    });

    it.each([
      ['on the client compilation', dictionary, { isServer: false }],
      ['without file aliases', {}, { isServer: true }],
    ])('does not add the javascript/auto rule %s', (_, props, options) => {
      const { config } = runWebpack(withGTConfig({}, props), options);

      expect(findAutoRule(config)).toBeUndefined();
    });
  });

  describe('Turbopack', () => {
    beforeEach(() => vi.stubEnv('TURBOPACK', '1'));

    it('adds aliases to turbopack.resolveAlias', () => {
      expect(
        withGTConfig({}, { dictionary: './my-dict.json' }).turbopack!
          .resolveAlias
      ).toHaveProperty('gt-next/internal/_dictionary');
    });

    it('preserves existing turbopack.resolveAlias entries', () => {
      const result = withGTConfig(
        { turbopack: { resolveAlias: { 'existing-alias': '/some/path' } } },
        { dictionary: './my-dict.json' }
      );

      expect(result.turbopack!.resolveAlias).toMatchObject({
        'existing-alias': '/some/path',
        'gt-next/internal/_dictionary': expect.anything(),
      });
    });
  });
});
