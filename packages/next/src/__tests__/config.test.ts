import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { NextConfig } from 'next';
import { BABEL_PLUGIN_SUPPORT } from '../plugin/constants';

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
  swcPluginCompatible: true,
  babelPluginCompatible: true,
}));

vi.mock('../plugin/getStableNextVersionInfo', () => mockVersionInfo);

// ---- Helpers ---- //

function parseConfigParams(result: NextConfig) {
  return JSON.parse(result.env!._GENERALTRANSLATION_I18N_CONFIG_PARAMS!);
}

function makeWebpackConfig() {
  return {
    context: '/fake/project',
    resolve: { alias: {} },
    plugins: [],
    cache: true,
  };
}

type WebpackConfig = ReturnType<typeof makeWebpackConfig>;
type WebpackConfigArg = Parameters<NonNullable<NextConfig['webpack']>>[0];
type WebpackOptions = Parameters<NonNullable<NextConfig['webpack']>>[1];

function makeWebpackOptions() {
  return { isServer: true } as WebpackOptions;
}

function runWebpack(result: NextConfig, config: WebpackConfig) {
  return result.webpack!(config as WebpackConfigArg, makeWebpackOptions());
}

// ---- Setup ---- //

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  delete process.env.GT_PROJECT_ID;
  delete process.env.GT_API_KEY;
  delete process.env.GT_DEV_API_KEY;
  delete process.env.NEXT_PUBLIC_GT_PROJECT_ID;
  delete process.env.NEXT_PUBLIC_GT_DEV_API_KEY;
  delete process.env.TURBOPACK;
  process.env.NODE_ENV = 'development';
  vi.clearAllMocks();
  mockVersionInfo.rootParamStability = 'experimental';
  mockVersionInfo.turboConfigStable = true;
  mockVersionInfo.swcPluginCompatible = true;
  mockVersionInfo.babelPluginCompatible = true;
  vi.mocked(fs.existsSync).mockReturnValue(false);
  vi.mocked(fs.readFileSync).mockReturnValue('{}');
});

afterEach(() => {
  process.env = savedEnv;
});

// ---- Tests ---- //

describe('withGTConfig', () => {
  // Lazy import to ensure mocks are in place
  async function getWithGTConfig() {
    const mod = await import('../config');
    return mod.withGTConfig;
  }

  // ==============================
  // 1. Default behavior
  // ==============================
  describe('1. Default behavior (no props, no config file)', () => {
    it('returns NextConfig with env, webpack, experimental', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();

      expect(result).toHaveProperty('env');
      expect(result).toHaveProperty('webpack');
      expect(result).toHaveProperty('experimental');
      expect(typeof result.webpack).toBe('function');
    });

    it('adds gt-next to transpilePackages while preserving user packages', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig({
        transpilePackages: ['existing-package', 'gt-next'],
      });

      expect(result.transpilePackages).toEqual(['existing-package', 'gt-next']);
    });

    it('sets _usingPlugin to true in config params', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params._usingPlugin).toBe(true);
    });

    it('defaults to locale "en"', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.defaultLocale).toBe('en');
      expect(result.env!._GENERALTRANSLATION_DEFAULT_LOCALE).toBe('en');
    });

    it('has GT services disabled (no projectId)', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe('false');
    });

    it('has loadDictionaryEnabled false and loadTranslationsType remote', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.loadDictionaryEnabled).toBe(false);
      expect(params.loadTranslationsType).toBe('remote');
      expect(result.env!._GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED).toBe(
        'false'
      );
      expect(result.env!._GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED).toBe(
        'false'
      );
    });

    it('has default batching config', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.maxConcurrentRequests).toBe(100);
      expect(params.maxBatchSize).toBe(25);
      expect(params.batchInterval).toBe(50);
    });

    it('has default compiler config', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.experimentalCompilerOptions).toMatchObject({
        type: 'none',
        logLevel: 'warn',
        compileTimeHash: true,
        disableBuildChecks: false,
      });
    });

    it('has default render settings for development', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.renderSettings).toMatchObject({
        method: 'default',
        timeout: 8000,
      });
    });

    it('has default headers/cookies values', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.headersAndCookies).toMatchObject({
        localeHeaderName: 'x-generaltranslation-locale',
        localeCookieName: 'generaltranslation.locale',
        enableI18nCookieName: 'generaltranslation.enable-i18n',
        referrerLocaleCookieName: 'generaltranslation.referrer-locale',
        localeRoutingEnabledCookieName:
          'generaltranslation.locale-routing-enabled',
        resetLocaleCookieName: 'generaltranslation.locale-reset',
      });
    });

    it('has ignoreBrowserLocales false', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();

      expect(result.env!._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES).toBe(
        'false'
      );
    });

    it('sets all expected _GENERALTRANSLATION_* env vars as strings', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();

      const gtKeys = Object.keys(result.env!).filter((k) =>
        k.startsWith('_GENERALTRANSLATION_')
      );
      expect(gtKeys.length).toBeGreaterThan(0);

      for (const key of gtKeys) {
        expect(typeof result.env![key]).toBe('string');
      }
    });

    it('has empty swcPlugins array in experimental', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();

      expect(result.experimental!.swcPlugins).toEqual([]);
    });

    it('sets experimental.rootParams to true (since mocked rootParamStability = experimental)', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();

      expect(result.experimental!.rootParams).toBe(true);
    });
  });

  // ==============================
  // 2. Config file loading
  // ==============================
  describe('2. Config file loading', () => {
    it('loads from ./gt.config.json when it exists', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ defaultLocale: 'fr' })
      );

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.defaultLocale).toBe('fr');
    });

    it('falls back to ./.gt/gt.config.json', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './.gt/gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ defaultLocale: 'de' })
      );

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.defaultLocale).toBe('de');
    });

    it('falls back to ./.locadex/gt.config.json (legacy)', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './.locadex/gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ defaultLocale: 'ja' })
      );

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.defaultLocale).toBe('ja');
    });

    it('prioritizes default path over .gt/ and .locadex/', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        if (p === './.gt/gt.config.json') return true;
        if (p === './.locadex/gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ defaultLocale: 'it' })
      );

      const result = withGTConfig();
      const params = parseConfigParams(result);

      // Should have loaded from ./gt.config.json (first priority)
      expect(params.defaultLocale).toBe('it');
    });

    it('uses custom props.config path directly', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './custom/my-config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ defaultLocale: 'ko' })
      );

      const result = withGTConfig({}, { config: './custom/my-config.json' });
      const params = parseConfigParams(result);

      expect(params.defaultLocale).toBe('ko');
    });

    it('handles invalid JSON in config file gracefully', async () => {
      const withGTConfig = await getWithGTConfig();
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue('not valid json!!!');

      // Should not throw, just use defaults
      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.defaultLocale).toBe('en');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('config file values merge into output correctly', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          defaultLocale: 'es',
          locales: ['es', 'en'],
          maxBatchSize: 50,
        })
      );

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.defaultLocale).toBe('es');
      expect(params.maxBatchSize).toBe(50);
      // locales should have defaultLocale prepended and be deduped
      expect(params.locales).toContain('es');
      expect(params.locales).toContain('en');
    });
  });

  // ==============================
  // 3. Config merge precedence
  // ==============================
  describe('3. Config merge precedence: props > env > config file > defaults', () => {
    it('config file values override defaults', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ maxBatchSize: 99 })
      );

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.maxBatchSize).toBe(99);
    });

    it('GT_PROJECT_ID env var is not serialized when config file has projectId', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.GT_PROJECT_ID = 'env-project-id';
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ projectId: 'config-project-id' })
      );

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.projectId).toBeUndefined();
    });

    it('props projectId is not serialized when overriding env vars', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.GT_PROJECT_ID = 'env-project-id';

      const result = withGTConfig({}, { projectId: 'props-project-id' });
      const params = parseConfigParams(result);

      expect(params.projectId).toBeUndefined();
    });

    it('full chain: each layer contributes different values', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.GT_PROJECT_ID = 'env-project-id';
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          maxBatchSize: 99, // config file value (no conflict with props)
          defaultLocale: 'fr', // config file value (overridden by props)
        })
      );

      const result = withGTConfig(
        {},
        { defaultLocale: 'fr', maxConcurrentRequests: 200 }
      );
      const params = parseConfigParams(result);

      // From config file (not overridden)
      expect(params.maxBatchSize).toBe(99);
      // From env (not serialized)
      expect(params.projectId).toBeUndefined();
      // From props (overrides all)
      expect(params.defaultLocale).toBe('fr');
      expect(params.maxConcurrentRequests).toBe(200);
      // From defaults (not overridden by any)
      expect(params.batchInterval).toBe(50);
    });
  });

  // ==============================
  // 4. Config conflict detection
  // ==============================
  describe('4. Config conflict detection', () => {
    it('throws when config file and props have differing primitive values', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ defaultLocale: 'fr' })
      );

      expect(() => withGTConfig({}, { defaultLocale: 'de' })).toThrow(
        /[Cc]onflicting/
      );
    });

    it('throws on differing arrays (different length)', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ locales: ['en', 'fr'] })
      );

      expect(() => withGTConfig({}, { locales: ['en'] })).toThrow(
        /[Cc]onflicting/
      );
    });

    it('throws on differing arrays (different values)', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ locales: ['en', 'fr'] })
      );

      expect(() => withGTConfig({}, { locales: ['en', 'de'] })).toThrow(
        /[Cc]onflicting/
      );
    });

    it('throws on differing objects', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          renderSettings: { method: 'skeleton', timeout: 5000 },
        })
      );

      expect(() =>
        withGTConfig(
          {},
          { renderSettings: { method: 'default', timeout: 5000 } }
        )
      ).toThrow(/[Cc]onflicting/);
    });

    it('throws when one is null and other is defined', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ runtimeUrl: null })
      );

      expect(() =>
        withGTConfig({}, { runtimeUrl: 'https://custom.example.com' })
      ).toThrow(/[Cc]onflicting/);
    });

    it('does NOT throw when values are identical (primitives)', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ defaultLocale: 'en' })
      );

      expect(() => withGTConfig({}, { defaultLocale: 'en' })).not.toThrow();
    });

    it('does NOT throw when values are identical (arrays)', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ locales: ['en', 'fr'] })
      );

      expect(() => withGTConfig({}, { locales: ['en', 'fr'] })).not.toThrow();
    });

    it('does NOT throw when values are identical (objects)', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          renderSettings: { method: 'default', timeout: 5000 },
        })
      );

      expect(() =>
        withGTConfig(
          {},
          { renderSettings: { method: 'default', timeout: 5000 } }
        )
      ).not.toThrow();
    });

    it('no conflict for keys only in config file (not in props)', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ maxBatchSize: 99 })
      );

      // props don't have maxBatchSize — no conflict
      expect(() => withGTConfig({}, { defaultLocale: 'en' })).not.toThrow();
    });

    it('error message contains key name and both values', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ defaultLocale: 'fr' })
      );

      try {
        withGTConfig({}, { defaultLocale: 'de' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = error instanceof Error ? error.message : '';
        expect(message).toContain('defaultLocale');
        expect(message).toContain('fr');
        expect(message).toContain('de');
      }
    });
  });

  // ==============================
  // 5. Environment variable handling
  // ==============================
  describe('5. Environment variable handling', () => {
    it('GT_PROJECT_ID enables services but is not serialized', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.GT_PROJECT_ID = 'my-project';
      process.env.GT_DEV_API_KEY = 'dev-key-value';

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe('true');
      expect(params.projectId).toBeUndefined();
    });

    it('GT_API_KEY in production enables services but is not serialized', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'production';
      process.env.GT_API_KEY = 'api-key-value';
      process.env.GT_PROJECT_ID = 'proj';

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe('true');
      expect(params.apiKey).toBeUndefined();
    });

    it('GT_DEV_API_KEY in development enables services but is not serialized', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'development';
      process.env.GT_PROJECT_ID = 'proj';
      process.env.GT_DEV_API_KEY = 'dev-key-value';

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe('true');
      expect(params.devApiKey).toBeUndefined();
    });

    it('GT_API_KEY in development is not serialized', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'development';
      process.env.GT_API_KEY = 'api-key-value';

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.apiKey).toBeUndefined();
    });

    it('NEXT_PUBLIC_GT_DEV_API_KEY is not serialized', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_GT_DEV_API_KEY = 'public-dev-key-value';

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.devApiKey).toBeUndefined();
    });

    it('does not parse key prefixes', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'development';
      process.env.GT_PROJECT_ID = 'proj';
      process.env.GT_DEV_API_KEY = 'not-prefixed';

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.devApiKey).toBeUndefined();
      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe('true');
    });
  });

  // ==============================
  // 6. Dictionary resolution
  // ==============================
  describe('6. Dictionary resolution', () => {
    it('props.dictionary string is used directly; file type set', async () => {
      const withGTConfig = await getWithGTConfig();

      const result = withGTConfig({}, { dictionary: './my-dict.json' });

      expect(result.env!._GENERALTRANSLATION_DICTIONARY_FILE_TYPE).toBe(
        '.json'
      );
    });

    it('resolves dictionary via resolveConfigFilepath fallback (e.g. ./dictionary.ts)', async () => {
      const withGTConfig = await getWithGTConfig();
      const resolvedPath = require('path').resolve('./dictionary.ts');
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === resolvedPath) return true;
        return false;
      });

      const result = withGTConfig();

      expect(result.env!._GENERALTRANSLATION_DICTIONARY_FILE_TYPE).toBe('.ts');
    });

    it('falls back to [defaultLocale].json then [languageCode].json', async () => {
      const withGTConfig = await getWithGTConfig();
      // No dictionary.ts/.js/.json found, but en.json exists
      const resolvedEnJsonPath = require('path').resolve('./en.json');
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === resolvedEnJsonPath) return true;
        return false;
      });

      const result = withGTConfig({}, { defaultLocale: 'en' });

      expect(result.env!._GENERALTRANSLATION_DICTIONARY_FILE_TYPE).toBe(
        '.json'
      );
    });

    it('no dictionary found = no _GENERALTRANSLATION_DICTIONARY_FILE_TYPE', async () => {
      const withGTConfig = await getWithGTConfig();
      // fs.existsSync returns false for everything (default mock)

      const result = withGTConfig();

      expect(
        result.env!._GENERALTRANSLATION_DICTIONARY_FILE_TYPE
      ).toBeUndefined();
    });

    it('correct file type for .ts extension', async () => {
      const withGTConfig = await getWithGTConfig();

      const result = withGTConfig({}, { dictionary: './dict.ts' });

      expect(result.env!._GENERALTRANSLATION_DICTIONARY_FILE_TYPE).toBe('.ts');
    });

    it('correct file type for .js extension', async () => {
      const withGTConfig = await getWithGTConfig();

      const result = withGTConfig({}, { dictionary: './dict.js' });

      expect(result.env!._GENERALTRANSLATION_DICTIONARY_FILE_TYPE).toBe('.js');
    });
  });

  // ==============================
  // 7. Custom loader paths
  // ==============================
  describe('7. Custom loader paths', () => {
    it('loadDictionaryPath resolves + file exists = local dictionary enabled', async () => {
      const withGTConfig = await getWithGTConfig();
      const resolvedPath = require('path').resolve('./loadDictionary.ts');
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === resolvedPath) return true;
        return false;
      });

      const result = withGTConfig(
        {},
        { loadDictionaryPath: './loadDictionary.ts' }
      );

      expect(result.env!._GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED).toBe(
        'true'
      );
    });

    it('loadTranslationsPath resolves + file exists = local translation enabled', async () => {
      const withGTConfig = await getWithGTConfig();
      const resolvedPath = require('path').resolve('./loadTranslations.ts');
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === resolvedPath) return true;
        return false;
      });

      const result = withGTConfig(
        {},
        { loadTranslationsPath: './loadTranslations.ts' }
      );

      expect(result.env!._GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED).toBe(
        'true'
      );
    });

    it('throws when loadDictionaryPath set but file does not exist', async () => {
      const withGTConfig = await getWithGTConfig();
      // fs.existsSync returns false by default

      expect(() =>
        withGTConfig(
          {},
          { loadDictionaryPath: './nonexistent/loadDictionary.ts' }
        )
      ).toThrow(/loadDictionary/);
    });

    it('throws when loadTranslationsPath set but file does not exist', async () => {
      const withGTConfig = await getWithGTConfig();
      // fs.existsSync returns false by default

      expect(() =>
        withGTConfig(
          {},
          { loadTranslationsPath: './nonexistent/loadTranslations.ts' }
        )
      ).toThrow(/loadTranslations/);
    });

    it('auto-resolves loadDictionary via resolveConfigFilepath when not in props', async () => {
      const withGTConfig = await getWithGTConfig();
      const resolvedAutoPath = require('path').resolve('./loadDictionary.ts');
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === resolvedAutoPath) return true;
        return false;
      });

      const result = withGTConfig();

      expect(result.env!._GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED).toBe(
        'true'
      );
    });

    it('auto-resolves loadTranslations via resolveConfigFilepath when not in props', async () => {
      const withGTConfig = await getWithGTConfig();
      const resolvedAutoPath = require('path').resolve('./loadTranslations.ts');
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === resolvedAutoPath) return true;
        return false;
      });

      const result = withGTConfig();

      expect(result.env!._GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED).toBe(
        'true'
      );
    });
  });

  // ==============================
  // 8. Locale handling
  // ==============================
  describe('8. Locale handling', () => {
    it('defaultLocale is prepended to locales array', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig(
        {},
        { defaultLocale: 'en', locales: ['fr', 'de'] }
      );
      const params = parseConfigParams(result);

      expect(params.locales[0]).toBe('en');
    });

    it('duplicates removed', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig(
        {},
        { defaultLocale: 'en', locales: ['en', 'fr', 'en'] }
      );
      const params = parseConfigParams(result);

      const enCount = params.locales.filter((l: string) => l === 'en').length;
      expect(enCount).toBe(1);
    });

    it('locales standardized via standardizeLocale() when GT services enabled', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.GT_PROJECT_ID = 'proj';
      process.env.GT_DEV_API_KEY = 'gt-dev-abc';
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = withGTConfig(
        {},
        { defaultLocale: 'en', locales: ['en-us', 'fr-fr'] }
      );
      const params = parseConfigParams(result);

      // standardizeLocale should normalize these
      // en-us -> en-US, fr-fr -> fr-FR (BCP-47 standardization)
      expect(params.locales).toContain('en-US');
      expect(params.locales).toContain('fr-FR');
    });

    it('locales NOT standardized when GT services disabled', async () => {
      const withGTConfig = await getWithGTConfig();
      // No projectId = GT services disabled

      const result = withGTConfig(
        {},
        { defaultLocale: 'en', locales: ['en-us', 'fr-fr'] }
      );
      const params = parseConfigParams(result);

      // Should keep original non-standardized values
      expect(params.locales).toContain('en-us');
      expect(params.locales).toContain('fr-fr');
    });

    it('empty locales + defaultLocale = [defaultLocale]', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig({}, { defaultLocale: 'en', locales: [] });
      const params = parseConfigParams(result);

      expect(params.locales).toEqual(['en']);
    });
  });

  // ==============================
  // 9. GT Services enabled logic
  // ==============================
  describe('9. GT Services enabled logic', () => {
    it('enabled: default runtimeUrl + dev apiKey + projectId', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'development';
      process.env.GT_DEV_API_KEY = 'gt-dev-abc';
      process.env.GT_PROJECT_ID = 'proj';
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = withGTConfig();

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe('true');
    });

    it('NOT enabled with only projectId and default cacheUrl (loadTranslationsType not yet set during check)', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.GT_PROJECT_ID = 'proj';
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // No API key; loadTranslationsType is not set at the time of the
      // gtRemoteCacheEnabled check (it gets set later in the function),
      // so gtServicesEnabled ends up false.
      const result = withGTConfig();

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe('false');
    });

    it('disabled: no projectId', async () => {
      const withGTConfig = await getWithGTConfig();
      // No GT_PROJECT_ID

      const result = withGTConfig();

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe('false');
    });

    it('disabled: custom runtimeUrl + null cacheUrl', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.GT_PROJECT_ID = 'proj';

      const result = withGTConfig(
        {},
        {
          runtimeUrl: 'https://custom-runtime.example.com',
          cacheUrl: null,
        }
      );

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe('false');
    });
  });

  // ==============================
  // 10. Error cases
  // ==============================
  describe('10. Error cases', () => {
    it('devApiKey in production throws devApiKeyIncludedInProductionError', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'production';
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => withGTConfig({}, { devApiKey: 'gt-dev-xyz' })).toThrow(
        /development API key/i
      );
    });

    it('invalid locales + GT services enabled throws invalidLocalesError', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.GT_PROJECT_ID = 'proj';
      process.env.GT_DEV_API_KEY = 'gt-dev-abc';
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() =>
        withGTConfig(
          {},
          { defaultLocale: 'en', locales: ['not-a-real-locale-xyz'] }
        )
      ).toThrow(/invalid locale/i);
    });

    it('invalid locales + GT services disabled does NOT throw', async () => {
      const withGTConfig = await getWithGTConfig();
      // No projectId = GT services disabled

      expect(() =>
        withGTConfig(
          {},
          { defaultLocale: 'en', locales: ['not-a-real-locale-xyz'] }
        )
      ).not.toThrow();
    });

    it('config conflicts throw conflictingConfigurationBuildError', async () => {
      const withGTConfig = await getWithGTConfig();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === './gt.config.json') return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ defaultLocale: 'fr' })
      );

      expect(() => withGTConfig({}, { defaultLocale: 'de' })).toThrow(
        /[Cc]onflicting configuration/
      );
    });

    it('invalid pathRegex throws a descriptive error', async () => {
      const withGTConfig = await getWithGTConfig();

      expect(() => withGTConfig({}, { pathRegex: '[unclosed' })).toThrowError(
        'gt-next Error: pathRegex "[unclosed" is not a valid regular expression.'
      );
    });

    it('missing loader files throw respective build errors', async () => {
      const withGTConfig = await getWithGTConfig();

      expect(() =>
        withGTConfig({}, { loadDictionaryPath: './missing/loadDictionary.ts' })
      ).toThrow(/loadDictionary.*could not be resolved/i);

      expect(() =>
        withGTConfig(
          {},
          { loadTranslationsPath: './missing/loadTranslations.ts' }
        )
      ).toThrow(/loadTranslations.*could not be resolved/i);
    });
  });

  // ==============================
  // 11. Cache expiry defaults
  // ==============================
  describe('11. Cache expiry defaults', () => {
    it('60000ms when: remote translations, no devApiKey, no explicit cacheExpiryTime', async () => {
      const withGTConfig = await getWithGTConfig();

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.cacheExpiryTime).toBe(60000);
    });

    it('NOT set when devApiKey present', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.GT_DEV_API_KEY = 'gt-dev-abc';
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = withGTConfig();
      const params = parseConfigParams(result);

      // cacheExpiryTime should remain undefined (not defaulted)
      expect(params.cacheExpiryTime).toBeUndefined();
    });

    it('NOT set when cacheExpiryTime explicitly provided', async () => {
      const withGTConfig = await getWithGTConfig();

      const result = withGTConfig({}, { cacheExpiryTime: 30000 });
      const params = parseConfigParams(result);

      expect(params.cacheExpiryTime).toBe(30000);
    });

    it('NOT set when loadTranslationsType === custom', async () => {
      const withGTConfig = await getWithGTConfig();
      const resolvedPath = require('path').resolve('./loadTranslations.ts');
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === resolvedPath) return true;
        return false;
      });

      const result = withGTConfig(
        {},
        { loadTranslationsPath: './loadTranslations.ts' }
      );
      const params = parseConfigParams(result);

      // loadTranslationsType is 'custom' so cacheExpiryTime should not be defaulted
      expect(params.cacheExpiryTime).toBeUndefined();
    });

    it('0 when cacheComponents is enabled', async () => {
      const withGTConfig = await getWithGTConfig();
      const resolvedPath = require('path').resolve('./loadTranslations.ts');
      vi.mocked(fs.existsSync).mockImplementation((p) => p === resolvedPath);

      const result = withGTConfig(
        { cacheComponents: true },
        { loadTranslationsPath: './loadTranslations.ts' }
      );
      const params = parseConfigParams(result);

      expect(params.cacheExpiryTime).toBe(0);
      expect(params._cacheComponentsEnabled).toBe(true);
      expect(params._disableDevHotReload).toBe(true);
    });

    it('overrides explicit cacheExpiryTime when cacheComponents is enabled', async () => {
      const withGTConfig = await getWithGTConfig();
      const resolvedPath = require('path').resolve('./loadTranslations.ts');
      vi.mocked(fs.existsSync).mockImplementation((p) => p === resolvedPath);

      const result = withGTConfig(
        { cacheComponents: true },
        {
          cacheExpiryTime: 30000,
          loadTranslationsPath: './loadTranslations.ts',
        }
      );
      const params = parseConfigParams(result);

      expect(params.cacheExpiryTime).toBe(0);
    });

    it('warns when cacheComponents disables active dev hot reload translation', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.GT_PROJECT_ID = 'project-id';
      process.env.GT_DEV_API_KEY = 'dev-key';
      const resolvedPath = require('path').resolve('./loadTranslations.ts');
      vi.mocked(fs.existsSync).mockImplementation((p) => p === resolvedPath);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = withGTConfig(
        { cacheComponents: true },
        {
          loadTranslationsPath: './loadTranslations.ts',
          getLocalePath: './getLocale.ts',
          getRegionPath: './getRegion.ts',
        }
      );
      const params = parseConfigParams(result);

      expect(params._disableDevHotReload).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'development runtime translation hot reload has been disabled'
        )
      );
    });

    it('throws when cacheComponents is enabled without custom loadTranslations', async () => {
      const withGTConfig = await getWithGTConfig();

      expect(() => withGTConfig({ cacheComponents: true })).toThrow(
        /custom loadTranslations\(\) is not configured/
      );
    });
  });

  // ==============================
  // 12. Output env vars completeness
  // ==============================
  describe('12. Output env vars completeness', () => {
    it('all expected _GENERALTRANSLATION_* keys present', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();

      const expectedKeys = [
        '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
        '_GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED',
        '_GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED',
        '_GENERALTRANSLATION_DEFAULT_LOCALE',
        '_GENERALTRANSLATION_GT_SERVICES_ENABLED',
        '_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES',
        '_GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED',
        '_GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED',
        '_GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING',
      ];

      for (const key of expectedKeys) {
        expect(result.env).toHaveProperty(key);
      }
    });

    it('preserves existing nextConfig.env', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig({ env: { MY_EXISTING_VAR: 'hello' } });

      expect(result.env!.MY_EXISTING_VAR).toBe('hello');
      expect(result.env!._GENERALTRANSLATION_I18N_CONFIG_PARAMS).toBeDefined();
    });

    it('exposes pathRegex to middleware and client code', async () => {
      const withGTConfig = await getWithGTConfig();
      const pathRegex = '^/(?!uk(?:/|$)).*';

      const result = withGTConfig({}, { pathRegex });

      expect(result.env!._GENERALTRANSLATION_PATH_REGEX).toBe(pathRegex);
    });

    it('I18N_CONFIG_PARAMS contains non-credential config as JSON string', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig(
        {},
        {
          projectId: 'project-id',
          apiKey: 'api-key',
          devApiKey: 'dev-key',
        }
      );

      const raw = result.env!._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
      expect(typeof raw).toBe('string');
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveProperty('defaultLocale');
      expect(parsed).toHaveProperty('_usingPlugin', true);
      expect(parsed.projectId).toBeUndefined();
      expect(parsed.apiKey).toBeUndefined();
      expect(parsed.devApiKey).toBeUndefined();
    });

    it('boolean flags are string "true"/"false", not booleans', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();

      expect(result.env!._GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED).toBe(
        'false'
      );
      expect(
        typeof result.env!._GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED
      ).toBe('string');

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe('false');
      expect(typeof result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe(
        'string'
      );
      expect(
        result.env!._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING
      ).toBe('false');
    });

    it('sets invalid locale warning env flag from withGTConfig props', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig({}, { disableInvalidLocaleWarning: true });

      expect(
        result.env!._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING
      ).toBe('true');
    });
  });

  // ==============================
  // 13. Compiler configuration
  // ==============================
  describe('13. Compiler configuration', () => {
    it.each(['none', 'swc'] as const)(
      'warns when automatic JSX injection is used with the %s compiler',
      async (type) => {
        const withGTConfig = await getWithGTConfig();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        withGTConfig(
          {},
          {
            experimentalCompilerOptions: {
              type,
              enableAutoJsxInjection: true,
            },
          }
        );

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Automatic JSX injection requires the GT webpack compiler'
          )
        );
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "Set experimentalCompilerOptions.type to 'babel'"
          )
        );
      }
    );

    it('uses a Turbopack-specific babel compiler warning', async () => {
      const withGTConfig = await getWithGTConfig();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.TURBOPACK = '1';

      const result = withGTConfig(
        {},
        {
          experimentalCompilerOptions: {
            type: 'babel',
            enableAutoJsxInjection: true,
          },
        }
      );
      const params = parseConfigParams(result);

      expect(params.experimentalCompilerOptions.type).toBe('none');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'The GT babel compiler is not compatible with Turbopack'
        )
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("experimentalCompilerOptions: { type: 'swc' }")
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Automatic JSX injection requires the GT webpack compiler'
        )
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('build with webpack')
      );
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('compatible with turbopack or < react')
      );
      warnSpy.mockRestore();
    });

    it('uses a React-version-specific babel compiler warning', async () => {
      const withGTConfig = await getWithGTConfig();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockVersionInfo.babelPluginCompatible = false;

      const result = withGTConfig(
        {},
        { experimentalCompilerOptions: { type: 'babel' } }
      );
      const params = parseConfigParams(result);

      expect(params.experimentalCompilerOptions.type).toBe('none');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `The GT babel compiler requires react@${BABEL_PLUGIN_SUPPORT} or newer`
        )
      );
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('compatible with turbopack or < react')
      );
      warnSpy.mockRestore();
    });

    it('warns for both babel compiler incompatibilities when both apply', async () => {
      const withGTConfig = await getWithGTConfig();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.TURBOPACK = '1';
      mockVersionInfo.babelPluginCompatible = false;

      const result = withGTConfig(
        {},
        { experimentalCompilerOptions: { type: 'babel' } }
      );
      const params = parseConfigParams(result);

      expect(params.experimentalCompilerOptions.type).toBe('none');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'The GT babel compiler is not compatible with Turbopack'
        )
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `The GT babel compiler requires react@${BABEL_PLUGIN_SUPPORT} or newer`
        )
      );
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('compatible with turbopack or < react')
      );
      warnSpy.mockRestore();
    });
  });

  // ==============================
  // 14. Webpack function
  // ==============================
  describe('14. Webpack function', () => {
    it('passes automatic JSX injection to the webpack compiler', async () => {
      const compiler = require('@generaltranslation/compiler');
      const compilerWebpackSpy = vi
        .spyOn(compiler, 'webpack')
        .mockReturnValue({});
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig(
        {},
        {
          experimentalCompilerOptions: {
            type: 'babel',
            enableAutoJsxInjection: true,
          },
        }
      );

      runWebpack(result, makeWebpackConfig());

      expect(compilerWebpackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          enableAutoJsxInjection: true,
          autoJsxImportSource: 'gt-next',
        })
      );
      compilerWebpackSpy.mockRestore();
    });

    it('returns webpack config object', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();

      const webpackResult = runWebpack(result, makeWebpackConfig());

      expect(webpackResult).toBeDefined();
      expect(webpackResult).toHaveProperty('resolve');
    });

    it('calls original nextConfig.webpack if present', async () => {
      const withGTConfig = await getWithGTConfig();
      const originalWebpack = vi.fn((config: WebpackConfig) => ({
        ...config,
        customProp: true,
      }));

      const result = withGTConfig({ webpack: originalWebpack });

      const webpackResult = runWebpack(result, makeWebpackConfig());

      expect(originalWebpack).toHaveBeenCalled();
      expect(webpackResult).toHaveProperty('customProp', true);
    });

    it('sets alias for dictionary when dictionary file found', async () => {
      const withGTConfig = await getWithGTConfig();

      const result = withGTConfig({}, { dictionary: './my-dict.json' });

      const wc = makeWebpackConfig();
      runWebpack(result, wc);

      expect(wc.resolve.alias).toHaveProperty('gt-next/internal/_dictionary');
    });

    // Mirrors webpack condition semantics: string = path prefix,
    // RegExp = test, array = any-of.
    type Condition = string | RegExp | Condition[];
    type RuleWebpackConfig = WebpackConfig & {
      module?: {
        rules?: { test: Condition; include?: Condition; type: string }[];
      };
    };
    function findAutoRule(wc: RuleWebpackConfig) {
      return (wc.module?.rules ?? []).find((r) => r.type === 'javascript/auto');
    }
    function conditionMatches(cond: Condition, p: string): boolean {
      return typeof cond === 'string'
        ? p.startsWith(cond)
        : Array.isArray(cond)
          ? cond.some((c) => conditionMatches(c, p))
          : cond.test(p);
    }
    function ruleAppliesTo(
      rule: NonNullable<ReturnType<typeof findAutoRule>>,
      p: string
    ) {
      return (
        conditionMatches(rule.test, p) &&
        (!rule.include || conditionMatches(rule.include, p))
      );
    }

    it('parses gt-next ESM dist as javascript/auto when a file alias is set', async () => {
      const withGTConfig = await getWithGTConfig();
      // The module dir only counts as gt-next's dist when its sentinel files
      // exist beside the compiled config (config.mjs, internal/_dictionary.mjs)
      vi.mocked(fs.existsSync).mockImplementation(
        (p) =>
          String(p).endsWith('config.mjs') ||
          String(p).endsWith(path.join('internal', '_dictionary.mjs'))
      );

      const result = withGTConfig({}, { dictionary: './my-dict.json' });

      const wc = makeWebpackConfig() as RuleWebpackConfig;
      runWebpack(result, wc);

      const rule = findAutoRule(wc);
      expect(rule).toBeDefined();

      // app-local, hoisted-root, and pnpm-store installs
      expect(
        ruleAppliesTo(rule!, '/app/node_modules/gt-next/dist/index.server.mjs')
      ).toBe(true);
      expect(
        ruleAppliesTo(
          rule!,
          '/repo/node_modules/.pnpm/gt-next@1.0.0/node_modules/gt-next/dist/index.server.mjs'
        )
      ).toBe(true);
      // symlinked install (workspace:*, file:) — real path has no node_modules
      // segment; matched via this package's own dist dir (__dirname of config)
      const moduleDir = path.resolve(__dirname, '..');
      expect(
        ruleAppliesTo(rule!, path.join(moduleDir, 'index.server.mjs'))
      ).toBe(true);
      // prefix collisions with sibling dirs never match
      expect(ruleAppliesTo(rule!, `${moduleDir}-other/index.server.mjs`)).toBe(
        false
      );
      // never CJS dist, never other packages
      expect(
        ruleAppliesTo(rule!, '/app/node_modules/gt-next/dist/index.server.js')
      ).toBe(false);
      expect(
        ruleAppliesTo(rule!, '/app/node_modules/other/dist/index.mjs')
      ).toBe(false);
    });

    it('does not widen the javascript/auto rule beyond node_modules when the module dir is not gt-next dist', async () => {
      const withGTConfig = await getWithGTConfig();
      // Default existsSync mock returns false: the sentinel check fails, as it
      // would if a bundler had inlined the config somewhere else. Only the
      // node_modules pattern may remain — a dir prefix here could sweep every
      // .mjs under the bundle output into javascript/auto.
      const result = withGTConfig({}, { dictionary: './my-dict.json' });

      const wc = makeWebpackConfig() as RuleWebpackConfig;
      runWebpack(result, wc);

      const rule = findAutoRule(wc);
      expect(rule).toBeDefined();
      const includes = Array.isArray(rule!.include)
        ? rule!.include
        : [rule!.include];
      expect(includes.every((c) => c instanceof RegExp)).toBe(true);
      expect(
        ruleAppliesTo(rule!, path.resolve(__dirname, '..', 'some.mjs'))
      ).toBe(false);
    });

    it('does not add the javascript/auto rule on the client compilation', async () => {
      const withGTConfig = await getWithGTConfig();

      const result = withGTConfig({}, { dictionary: './my-dict.json' });

      const wc = makeWebpackConfig() as WebpackConfig & {
        module?: { rules?: { test: RegExp; type: string }[] };
      };
      result.webpack!(
        wc as WebpackConfigArg,
        { isServer: false } as WebpackOptions
      );

      expect(
        (wc.module?.rules ?? []).some((r) => r.type === 'javascript/auto')
      ).toBe(false);
    });

    it('does not add the javascript/auto rule without file aliases', async () => {
      const withGTConfig = await getWithGTConfig();

      const result = withGTConfig({}, {});

      const wc = makeWebpackConfig() as WebpackConfig & {
        module?: { rules?: { test: RegExp; type: string }[] };
      };
      runWebpack(result, wc);

      expect(
        (wc.module?.rules ?? []).some((r) => r.type === 'javascript/auto')
      ).toBe(false);
    });

    it('adds the javascript/auto rule when only a request-function alias is set', async () => {
      const withGTConfig = await getWithGTConfig();

      // No dictionary or loader options: the request-function alias alone
      // must enable the rule, keeping the guard in lockstep with the alias
      // block (see config.ts).
      const result = withGTConfig({}, { getLocalePath: './my-get-locale.ts' });

      const wc = makeWebpackConfig() as RuleWebpackConfig;
      runWebpack(result, wc);

      expect(wc.resolve.alias).toHaveProperty('gt-next/internal/_getLocale');
      expect(findAutoRule(wc)).toBeDefined();
    });

    it('does NOT set aliases when TURBOPACK enabled', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.TURBOPACK = '1';

      const result = withGTConfig({}, { dictionary: './my-dict.json' });

      const wc = makeWebpackConfig();
      runWebpack(result, wc);

      expect(wc.resolve.alias).not.toHaveProperty(
        'gt-next/internal/_dictionary'
      );
    });

    it('disables webpackConfig.cache in development', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'development';

      const result = withGTConfig();

      const wc = makeWebpackConfig();
      runWebpack(result, wc);

      expect(wc.cache).toBe(false);
    });
  });

  // ==============================
  // 15. Turbopack configuration
  // ==============================
  describe('15. Turbopack configuration', () => {
    it('when TURBOPACK=1 + turboConfigStable=true (no legacy turbo config): aliases in result.turbopack.resolveAlias', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.TURBOPACK = '1';

      const result = withGTConfig({}, { dictionary: './my-dict.json' });

      expect(result.turbopack).toBeDefined();
      expect(result.turbopack!.resolveAlias).toBeDefined();
      expect(result.turbopack!.resolveAlias).toHaveProperty(
        'gt-next/internal/_dictionary'
      );
    });

    it('preserves existing nextConfig.turbopack properties', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.TURBOPACK = '1';

      const result = withGTConfig(
        {
          turbopack: {
            resolveAlias: { 'existing-alias': '/some/path' },
          },
        },
        { dictionary: './my-dict.json' }
      );

      expect(result.turbopack!.resolveAlias).toHaveProperty(
        'existing-alias',
        '/some/path'
      );
      expect(result.turbopack!.resolveAlias).toHaveProperty(
        'gt-next/internal/_dictionary'
      );
    });
  });

  // ==============================
  // 16. Headers/cookies merging
  // ==============================
  describe('16. Headers/cookies merging', () => {
    it('default values used when none provided', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.headersAndCookies.localeHeaderName).toBe(
        'x-generaltranslation-locale'
      );
      expect(params.headersAndCookies.localeCookieName).toBe(
        'generaltranslation.locale'
      );
      expect(params.headersAndCookies.enableI18nCookieName).toBe(
        'generaltranslation.enable-i18n'
      );
    });

    it('partial override merges with defaults', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig(
        {},
        {
          headersAndCookies: {
            localeCookieName: 'my-custom-cookie',
          },
        }
      );
      const params = parseConfigParams(result);

      expect(params.headersAndCookies.localeCookieName).toBe(
        'my-custom-cookie'
      );
      // Other values should remain defaults
      expect(params.headersAndCookies.localeHeaderName).toBe(
        'x-generaltranslation-locale'
      );
    });

    it('full override replaces all values', async () => {
      const withGTConfig = await getWithGTConfig();
      const customHeaders = {
        localeHeaderName: 'x-my-locale',
        localeCookieName: 'my-locale',
        referrerLocaleCookieName: 'my-referrer',
        localeRoutingEnabledCookieName: 'my-routing',
        resetLocaleCookieName: 'my-reset',
      };

      const result = withGTConfig({}, { headersAndCookies: customHeaders });
      const params = parseConfigParams(result);

      expect(params.headersAndCookies).toMatchObject(customHeaders);
    });
  });

  // ==============================
  // 17. nextConfig passthrough
  // ==============================
  describe('17. nextConfig passthrough', () => {
    it('preserves all existing nextConfig properties', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig({
        images: { domains: ['example.com'] },
        reactStrictMode: true,
        compress: false,
      });

      expect(result.images).toEqual({
        domains: ['example.com'],
      });
      expect(result.reactStrictMode).toBe(true);
      expect(result.compress).toBe(false);
    });

    it('handles empty {} nextConfig', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig({});

      expect(result).toHaveProperty('env');
      expect(result).toHaveProperty('webpack');
      expect(result).toHaveProperty('experimental');
    });

    it('handles undefined nextConfig', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig(undefined);

      expect(result).toHaveProperty('env');
      expect(result).toHaveProperty('webpack');
      expect(result).toHaveProperty('experimental');
    });
  });

  // ==============================
  // 18. Function-form next config
  // ==============================
  describe('18. Function-form next config', () => {
    it('calls a sync config function and layers GT on the result', async () => {
      const withGTConfig = await getWithGTConfig();
      const built = withGTConfig(
        (_phase: string): NextConfig => ({
          reactStrictMode: true,
        })
      );

      expect(typeof built).toBe('function');
      const resolved = (
        built as unknown as (
          phase: string,
          context: { defaultConfig: NextConfig }
        ) => NextConfig
      )('phase-production-build', { defaultConfig: {} });

      expect(resolved.reactStrictMode).toBe(true);
      expect(resolved).toHaveProperty('env');
      expect(typeof resolved.webpack).toBe('function');
      expect(resolved.transpilePackages).toContain('gt-next');
    });

    it('awaits an async config function and layers GT on the result', async () => {
      const withGTConfig = await getWithGTConfig();
      const built = withGTConfig(
        async (_phase: string): Promise<NextConfig> => ({
          reactStrictMode: true,
        })
      );

      const resolved = await (
        built as unknown as (
          phase: string,
          context: { defaultConfig: NextConfig }
        ) => Promise<NextConfig>
      )('phase-production-build', { defaultConfig: {} });

      expect(resolved.reactStrictMode).toBe(true);
      expect(resolved).toHaveProperty('env');
      expect(typeof resolved.webpack).toBe('function');
      expect(resolved.transpilePackages).toContain('gt-next');
    });
  });
});
