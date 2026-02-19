import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import type { NextConfig } from 'next';

// ---- Mocks ---- //

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '{}'),
  },
}));

vi.mock('../plugin/getStableNextVersionInfo', () => ({
  rootParamStability: 'experimental',
  turboConfigStable: true,
  swcPluginCompatible: true,
  babelPluginCompatible: true,
}));

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

function makeWebpackOptions() {
  return { isServer: true } as any;
}

// ---- Setup ---- //

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  delete process.env.GT_PROJECT_ID;
  delete process.env.GT_API_KEY;
  delete process.env.GT_DEV_API_KEY;
  delete process.env.TURBOPACK;
  process.env.NODE_ENV = 'development';
  vi.clearAllMocks();
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

  async function getInitGT() {
    const mod = await import('../config');
    return mod.initGT;
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

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe(
        'false'
      );
    });

    it('has loadDictionaryEnabled false and loadTranslationsType remote', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.loadDictionaryEnabled).toBe(false);
      expect(params.loadTranslationsType).toBe('remote');
      expect(
        result.env!._GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED
      ).toBe('false');
      expect(
        result.env!._GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED
      ).toBe('false');
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
        referrerLocaleCookieName: 'generaltranslation.referrer-locale',
        localeRoutingEnabledCookieName:
          'generaltranslation.locale-routing-enabled',
        resetLocaleCookieName: 'generaltranslation.locale-reset',
      });
    });

    it('has ignoreBrowserLocales false', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();

      expect(
        result.env!._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES
      ).toBe('false');
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

    it('GT_PROJECT_ID env var overrides config file projectId', async () => {
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

      expect(params.projectId).toBe('env-project-id');
    });

    it('props override env vars', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.GT_PROJECT_ID = 'env-project-id';

      const result = withGTConfig(
        {},
        { projectId: 'props-project-id' }
      );
      const params = parseConfigParams(result);

      expect(params.projectId).toBe('props-project-id');
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
      // From env (overrides config file)
      expect(params.projectId).toBe('env-project-id');
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

      expect(() =>
        withGTConfig({}, { defaultLocale: 'de' })
      ).toThrow(/[Cc]onflicting/);
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

      expect(() =>
        withGTConfig({}, { locales: ['en'] })
      ).toThrow(/[Cc]onflicting/);
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

      expect(() =>
        withGTConfig({}, { locales: ['en', 'de'] })
      ).toThrow(/[Cc]onflicting/);
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
        withGTConfig(
          {},
          { runtimeUrl: 'https://custom.example.com' }
        )
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

      expect(() =>
        withGTConfig({}, { defaultLocale: 'en' })
      ).not.toThrow();
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

      expect(() =>
        withGTConfig({}, { locales: ['en', 'fr'] })
      ).not.toThrow();
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
      expect(() =>
        withGTConfig({}, { defaultLocale: 'en' })
      ).not.toThrow();
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
      } catch (e: any) {
        expect(e.message).toContain('defaultLocale');
        expect(e.message).toContain('fr');
        expect(e.message).toContain('de');
      }
    });
  });

  // ==============================
  // 5. Environment variable handling
  // ==============================
  describe('5. Environment variable handling', () => {
    it('GT_PROJECT_ID sets projectId in merged config', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.GT_PROJECT_ID = 'my-project';

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.projectId).toBe('my-project');
    });

    it('GT_API_KEY with gt-api- prefix in production sets apiKey', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'production';
      process.env.GT_API_KEY = 'gt-api-xyz';
      process.env.GT_PROJECT_ID = 'proj';

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.apiKey).toBe('gt-api-xyz');
    });

    it('GT_DEV_API_KEY with gt-dev- prefix in development sets devApiKey', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'development';
      process.env.GT_DEV_API_KEY = 'gt-dev-xyz';

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.devApiKey).toBe('gt-dev-xyz');
    });

    it('GT_API_KEY in development (no dev key) sets apiKey', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'development';
      process.env.GT_API_KEY = 'gt-api-xyz';

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.apiKey).toBe('gt-api-xyz');
    });

    it('GT_DEV_API_KEY preferred over GT_API_KEY in development', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'development';
      process.env.GT_DEV_API_KEY = 'gt-dev-preferred';
      process.env.GT_API_KEY = 'gt-api-fallback';

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.devApiKey).toBe('gt-dev-preferred');
      // apiKey should not be set from GT_API_KEY since GT_DEV_API_KEY took precedence
      expect(params.apiKey).toBeUndefined();
    });

    it('key with unknown prefix sets neither apiKey nor devApiKey', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'development';
      process.env.GT_API_KEY = 'gt-unknown-xyz';

      const result = withGTConfig();
      const params = parseConfigParams(result);

      expect(params.apiKey).toBeUndefined();
      expect(params.devApiKey).toBeUndefined();
    });
  });

  // ==============================
  // 6. Dictionary resolution
  // ==============================
  describe('6. Dictionary resolution', () => {
    it('props.dictionary string is used directly; file type set', async () => {
      const withGTConfig = await getWithGTConfig();

      const result = withGTConfig({}, { dictionary: './my-dict.json' });

      expect(
        result.env!._GENERALTRANSLATION_DICTIONARY_FILE_TYPE
      ).toBe('.json');
    });

    it('resolves dictionary via resolveConfigFilepath fallback (e.g. ./dictionary.ts)', async () => {
      const withGTConfig = await getWithGTConfig();
      const resolvedPath = require('path').resolve('./dictionary.ts');
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === resolvedPath) return true;
        return false;
      });

      const result = withGTConfig();

      expect(
        result.env!._GENERALTRANSLATION_DICTIONARY_FILE_TYPE
      ).toBe('.ts');
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

      expect(
        result.env!._GENERALTRANSLATION_DICTIONARY_FILE_TYPE
      ).toBe('.json');
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

      expect(
        result.env!._GENERALTRANSLATION_DICTIONARY_FILE_TYPE
      ).toBe('.ts');
    });

    it('correct file type for .js extension', async () => {
      const withGTConfig = await getWithGTConfig();

      const result = withGTConfig({}, { dictionary: './dict.js' });

      expect(
        result.env!._GENERALTRANSLATION_DICTIONARY_FILE_TYPE
      ).toBe('.js');
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

      expect(
        result.env!._GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED
      ).toBe('true');
    });

    it('loadTranslationsPath resolves + file exists = local translation enabled', async () => {
      const withGTConfig = await getWithGTConfig();
      const resolvedPath = require('path').resolve(
        './loadTranslations.ts'
      );
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === resolvedPath) return true;
        return false;
      });

      const result = withGTConfig(
        {},
        { loadTranslationsPath: './loadTranslations.ts' }
      );

      expect(
        result.env!._GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED
      ).toBe('true');
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
      const resolvedAutoPath = require('path').resolve(
        './loadDictionary.ts'
      );
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === resolvedAutoPath) return true;
        return false;
      });

      const result = withGTConfig();

      expect(
        result.env!._GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED
      ).toBe('true');
    });

    it('auto-resolves loadTranslations via resolveConfigFilepath when not in props', async () => {
      const withGTConfig = await getWithGTConfig();
      const resolvedAutoPath = require('path').resolve(
        './loadTranslations.ts'
      );
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === resolvedAutoPath) return true;
        return false;
      });

      const result = withGTConfig();

      expect(
        result.env!._GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED
      ).toBe('true');
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

      const enCount = params.locales.filter(
        (l: string) => l === 'en'
      ).length;
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
      const result = withGTConfig(
        {},
        { defaultLocale: 'en', locales: [] }
      );
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

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe(
        'true'
      );
    });

    it('NOT enabled with only projectId and default cacheUrl (loadTranslationsType not yet set during check)', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.GT_PROJECT_ID = 'proj';
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // No API key; loadTranslationsType is not set at the time of the
      // gtRemoteCacheEnabled check (it gets set later in the function),
      // so gtServicesEnabled ends up false.
      const result = withGTConfig();

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe(
        'false'
      );
    });

    it('disabled: no projectId', async () => {
      const withGTConfig = await getWithGTConfig();
      // No GT_PROJECT_ID

      const result = withGTConfig();

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe(
        'false'
      );
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

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe(
        'false'
      );
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

      expect(() =>
        withGTConfig({}, { devApiKey: 'gt-dev-xyz' })
      ).toThrow(/development API key/i);
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

      expect(() =>
        withGTConfig({}, { defaultLocale: 'de' })
      ).toThrow(/[Cc]onflicting configuration/);
    });

    it('missing loader files throw respective build errors', async () => {
      const withGTConfig = await getWithGTConfig();

      expect(() =>
        withGTConfig(
          {},
          { loadDictionaryPath: './missing/loadDictionary.ts' }
        )
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
      const resolvedPath = require('path').resolve(
        './loadTranslations.ts'
      );
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
        '_GENERALTRANSLATION_CUSTOM_GET_DOMAIN_ENABLED',
        '_GENERALTRANSLATION_STATIC_GET_LOCALE_ENABLED',
        '_GENERALTRANSLATION_STATIC_GET_REGION_ENABLED',
        '_GENERALTRANSLATION_STATIC_GET_DOMAIN_ENABLED',
        '_GENERALTRANSLATION_DISABLE_SSG_WARNINGS',
        '_GENERALTRANSLATION_ENABLE_SSG',
        '_GENERALTRANSLATION_EXPERIMENTAL_LOCALE_RESOLUTION',
        '_GENERALTRANSLATION_EXPERIMENTAL_LOCALE_RESOLUTION_PARAM',
      ];

      for (const key of expectedKeys) {
        expect(result.env).toHaveProperty(key);
      }
    });

    it('preserves existing nextConfig.env', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig({ env: { MY_EXISTING_VAR: 'hello' } });

      expect(result.env!.MY_EXISTING_VAR).toBe('hello');
      expect(
        result.env!._GENERALTRANSLATION_I18N_CONFIG_PARAMS
      ).toBeDefined();
    });

    it('I18N_CONFIG_PARAMS contains full merged config as JSON string', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();

      const raw = result.env!._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
      expect(typeof raw).toBe('string');
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveProperty('defaultLocale');
      expect(parsed).toHaveProperty('_usingPlugin', true);
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

      expect(result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED).toBe(
        'false'
      );
      expect(
        typeof result.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED
      ).toBe('string');
    });
  });

  // ==============================
  // 13. Webpack function
  // ==============================
  describe('13. Webpack function', () => {
    it('returns webpack config object', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig();

      const webpackResult = result.webpack!(
        makeWebpackConfig() as any,
        makeWebpackOptions()
      );

      expect(webpackResult).toBeDefined();
      expect(webpackResult).toHaveProperty('resolve');
    });

    it('calls original nextConfig.webpack if present', async () => {
      const withGTConfig = await getWithGTConfig();
      const originalWebpack = vi.fn((config: any) => ({
        ...config,
        customProp: true,
      }));

      const result = withGTConfig({ webpack: originalWebpack });

      const webpackResult = result.webpack!(
        makeWebpackConfig() as any,
        makeWebpackOptions()
      );

      expect(originalWebpack).toHaveBeenCalled();
      expect(webpackResult).toHaveProperty('customProp', true);
    });

    it('sets alias for dictionary when dictionary file found', async () => {
      const withGTConfig = await getWithGTConfig();

      const result = withGTConfig({}, { dictionary: './my-dict.json' });

      const wc = makeWebpackConfig();
      result.webpack!(wc as any, makeWebpackOptions());

      expect(wc.resolve.alias).toHaveProperty('gt-next/_dictionary');
    });

    it('does NOT set aliases when TURBOPACK enabled', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.TURBOPACK = '1';

      const result = withGTConfig({}, { dictionary: './my-dict.json' });

      const wc = makeWebpackConfig();
      result.webpack!(wc as any, makeWebpackOptions());

      expect(wc.resolve.alias).not.toHaveProperty('gt-next/_dictionary');
    });

    it('disables webpackConfig.cache in development', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.NODE_ENV = 'development';

      const result = withGTConfig();

      const wc = makeWebpackConfig();
      result.webpack!(wc as any, makeWebpackOptions());

      expect(wc.cache).toBe(false);
    });
  });

  // ==============================
  // 14. Turbopack configuration
  // ==============================
  describe('14. Turbopack configuration', () => {
    it('when TURBOPACK=1 + turboConfigStable=true (no legacy turbo config): aliases in result.turbopack.resolveAlias', async () => {
      const withGTConfig = await getWithGTConfig();
      process.env.TURBOPACK = '1';

      const result = withGTConfig(
        {},
        { dictionary: './my-dict.json' }
      );

      expect(result.turbopack).toBeDefined();
      expect(result.turbopack!.resolveAlias).toBeDefined();
      expect(result.turbopack!.resolveAlias).toHaveProperty(
        'gt-next/_dictionary'
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
        } as any,
        { dictionary: './my-dict.json' }
      );

      expect(result.turbopack!.resolveAlias).toHaveProperty(
        'existing-alias',
        '/some/path'
      );
      expect(result.turbopack!.resolveAlias).toHaveProperty(
        'gt-next/_dictionary'
      );
    });
  });

  // ==============================
  // 15. Headers/cookies merging
  // ==============================
  describe('15. Headers/cookies merging', () => {
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

      const result = withGTConfig(
        {},
        { headersAndCookies: customHeaders }
      );
      const params = parseConfigParams(result);

      expect(params.headersAndCookies).toMatchObject(customHeaders);
    });
  });

  // ==============================
  // 16. nextConfig passthrough
  // ==============================
  describe('16. nextConfig passthrough', () => {
    it('preserves all existing nextConfig properties', async () => {
      const withGTConfig = await getWithGTConfig();
      const result = withGTConfig({
        images: { domains: ['example.com'] },
        reactStrictMode: true,
        compress: false,
      } as any);

      expect((result as any).images).toEqual({
        domains: ['example.com'],
      });
      expect((result as any).reactStrictMode).toBe(true);
      expect((result as any).compress).toBe(false);
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
  // 17. initGT backward compatibility
  // ==============================
  describe('17. initGT backward compatibility', () => {
    it('initGT(props) returns a function (nextConfig) => NextConfig', async () => {
      const initGT = await getInitGT();
      const configFn = initGT({ defaultLocale: 'es' });

      expect(typeof configFn).toBe('function');
    });

    it('produces equivalent result to withGTConfig(nextConfig, props)', async () => {
      const { withGTConfig, initGT } = await import('../config');
      const props = { defaultLocale: 'es' };
      const nextConfig = {};

      const resultA = withGTConfig(nextConfig, props);
      const resultB = initGT(props)(nextConfig);

      // Compare the env vars (serialized config params)
      expect(resultA.env!._GENERALTRANSLATION_I18N_CONFIG_PARAMS).toBe(
        resultB.env!._GENERALTRANSLATION_I18N_CONFIG_PARAMS
      );
      expect(resultA.env!._GENERALTRANSLATION_DEFAULT_LOCALE).toBe(
        resultB.env!._GENERALTRANSLATION_DEFAULT_LOCALE
      );
      expect(
        resultA.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED
      ).toBe(resultB.env!._GENERALTRANSLATION_GT_SERVICES_ENABLED);
    });
  });
});
