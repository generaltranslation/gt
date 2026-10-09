import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import type { Plugin, ResolvedConfig } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gtTanstackStart } from '../vite';
import type { GTTanstackStartPluginOptions } from '../vite';

const COMPILER_PLUGIN_NAME = '@generaltranslation/GT_PLUGIN';

const T_FIXTURE = `
  import { jsx } from 'react/jsx-runtime';
  import { T } from 'gt-tanstack-start';
  export const el = jsx(T, { children: "Hello world" });
`;

const tempDirs: string[] = [];

const BABEL: Omit<GTTanstackStartPluginOptions, 'config'> = {
  experimentalCompilerOptions: { type: 'babel' },
};

function createPlugins(
  options: Omit<GTTanstackStartPluginOptions, 'config'> = {},
  configContents: Record<string, unknown> = {}
): { plugins: Plugin[]; root: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-tanstack-start-'));
  tempDirs.push(root);
  const config = path.join(root, 'gt.config.json');
  fs.writeFileSync(
    config,
    JSON.stringify({ defaultLocale: 'en', locales: ['fr'], ...configContents })
  );
  return { plugins: gtTanstackStart({ ...options, config }), root };
}

function findPlugin(plugins: Plugin[], name: string): Plugin | undefined {
  return plugins.find((plugin) => plugin.name === name);
}

async function runTransform(
  plugin: Plugin,
  code: string,
  id: string
): Promise<string | null> {
  const transform = plugin.transform;
  if (!transform) throw new Error('Expected a transform hook');
  const handler =
    typeof transform === 'function' ? transform : transform.handler;
  const result = await handler.call(
    {} as ThisParameterType<typeof handler>,
    code,
    id
  );
  if (!result) return null;
  return typeof result === 'string' ? result : (result.code ?? null);
}

function resolveConfig(
  configPlugin: Plugin,
  root: string,
  plugins: Plugin[]
): ReturnType<typeof vi.fn> {
  const warnOnce = vi.fn();
  const configResolved = configPlugin.configResolved;
  if (typeof configResolved !== 'function') {
    throw new Error('Expected a configResolved hook');
  }
  configResolved.call(
    {} as ThisParameterType<typeof configResolved>,
    { root, plugins, logger: { warnOnce } } as unknown as ResolvedConfig
  );
  return warnOnce;
}

describe('gtTanstackStart', () => {
  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('omits the GT compiler plugin by default', () => {
    const { plugins } = createPlugins();

    expect(plugins.map((plugin) => plugin.name)).toEqual(['gt-tanstack-start']);
  });

  it("includes the GT compiler plugin when type is 'babel'", () => {
    const { plugins } = createPlugins(BABEL);

    expect(plugins.map((plugin) => plugin.name)).toEqual([
      'gt-tanstack-start',
      COMPILER_PLUGIN_NAME,
    ]);
  });

  it('warns when gt.config.json enables auto JSX injection without the compiler', () => {
    const { plugins, root } = createPlugins(
      {},
      { files: { gt: { parsingFlags: { enableAutoJsxInjection: true } } } }
    );

    const warnOnce = resolveConfig(plugins[0], root, plugins);
    expect(warnOnce).toHaveBeenCalledWith(
      expect.stringContaining(
        'Automatic JSX injection requires the GT compiler'
      )
    );
  });

  it("omits the GT compiler plugin when type is 'none'", () => {
    const { plugins } = createPlugins({
      experimentalCompilerOptions: { type: 'none' },
    });

    expect(plugins.map((plugin) => plugin.name)).toEqual(['gt-tanstack-start']);
  });

  it('omits the GT compiler plugin and warns when compileTimeHash is false', () => {
    const { plugins, root } = createPlugins({
      experimentalCompilerOptions: { type: 'babel', compileTimeHash: false },
    });

    expect(plugins.map((plugin) => plugin.name)).toEqual(['gt-tanstack-start']);
    const warnOnce = resolveConfig(plugins[0], root, plugins);
    expect(warnOnce).toHaveBeenCalledWith(
      expect.stringContaining('Compile-time hashing is disabled')
    );
  });

  it('injects _hash into <T> imported from gt-tanstack-start', async () => {
    const { plugins, root } = createPlugins(BABEL);
    const compiler = findPlugin(plugins, COMPILER_PLUGIN_NAME)!;

    const output = await runTransform(
      compiler,
      T_FIXTURE,
      path.join(root, 'src/routes/index.tsx')
    );

    expect(output).toContain('_hash: "');
  });

  it('injects _hash into TanStack Router code-split route modules', async () => {
    const { plugins, root } = createPlugins(BABEL);
    const compiler = findPlugin(plugins, COMPILER_PLUGIN_NAME)!;

    const output = await runTransform(
      compiler,
      T_FIXTURE,
      `${path.join(root, 'src/routes/index.tsx')}?tsr-split=component`
    );

    expect(output).toContain('_hash: "');
  });

  it('skips other query modules', async () => {
    const { plugins, root } = createPlugins(BABEL);
    const compiler = findPlugin(plugins, COMPILER_PLUGIN_NAME)!;

    const output = await runTransform(
      compiler,
      T_FIXTURE,
      `${path.join(root, 'src/routes/index.tsx')}?raw`
    );

    expect(output).toBeNull();
  });

  it('skips modules in node_modules', async () => {
    const { plugins, root } = createPlugins(BABEL);
    const compiler = findPlugin(plugins, COMPILER_PLUGIN_NAME)!;

    const output = await runTransform(
      compiler,
      T_FIXTURE,
      path.join(root, 'node_modules/some-dependency/index.js')
    );

    expect(output).toBeNull();
    expect(compiler.transform).toMatchObject({
      filter: { id: { exclude: expect.any(RegExp) } },
    });
  });

  it('warns when the GT compiler plugin is registered more than once', () => {
    const { plugins, root } = createPlugins(BABEL);
    const compiler = findPlugin(plugins, COMPILER_PLUGIN_NAME)!;

    const warnOnce = resolveConfig(plugins[0], root, [
      ...plugins,
      { name: COMPILER_PLUGIN_NAME },
    ]);
    expect(warnOnce).toHaveBeenCalledWith(
      expect.stringContaining(
        'The GT compiler plugin is registered more than once'
      )
    );

    const singleWarnOnce = resolveConfig(plugins[0], root, [
      plugins[0],
      compiler,
    ]);
    expect(singleWarnOnce).not.toHaveBeenCalled();
  });
});

const CONFIG_MODULE_ID = 'gt-tanstack-start/internal/_config';

type ConfigModuleExports = {
  config: unknown;
  loadTranslations?: (locale: string) => Promise<unknown>;
  dictionary?: unknown;
  loadDictionary?: (locale: string) => Promise<unknown>;
};

/**
 * Writes a temporary app and creates the plugin from its directory, as a
 * vite.config.ts run from the app root does.
 */
function createProject(
  files: Record<string, string>,
  config = 'gt.config.json',
  options: Omit<GTTanstackStartPluginOptions, 'config'> = {}
): { configPlugin: Plugin; root: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-tanstack-start-'));
  tempDirs.push(root);
  for (const [file, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), contents);
  }
  const cwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
  try {
    const [configPlugin] = gtTanstackStart({
      config,
      experimentalCompilerOptions: { type: 'none' },
      ...options,
    });
    return { configPlugin, root };
  } finally {
    cwd.mockRestore();
  }
}

function gtConfig(output?: string): string {
  return JSON.stringify({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    ...(output ? { files: { gt: { output } } } : {}),
  });
}

/** Runs the plugin's resolveId and load hooks for the config module. */
async function loadConfigModuleCode(
  configPlugin: Plugin,
  root: string
): Promise<{
  code: string;
  watchFiles: string[];
  warnOnce: ReturnType<typeof vi.fn>;
}> {
  const warnOnce = resolveConfig(configPlugin, root, [configPlugin]);
  const resolveId = configPlugin.resolveId;
  const load = configPlugin.load;
  if (typeof resolveId !== 'function' || typeof load !== 'function') {
    throw new Error('Expected resolveId and load hooks');
  }
  const id = await resolveId.call(
    {} as ThisParameterType<typeof resolveId>,
    CONFIG_MODULE_ID,
    undefined,
    { isEntry: false } as Parameters<typeof resolveId>[2]
  );
  if (typeof id !== 'string') throw new Error('Expected a resolved id');
  const watchFiles: string[] = [];
  const code = await load.call(
    {
      addWatchFile: (file: string) => watchFiles.push(file),
    } as unknown as ThisParameterType<typeof load>,
    id
  );
  if (typeof code !== 'string') throw new Error('Expected module code');
  return { code, watchFiles, warnOnce };
}

/** Evaluates the config module through a real Vite server. */
async function withConfigModule(
  configPlugin: Plugin,
  root: string,
  callback: (module: ConfigModuleExports) => Promise<void>
): Promise<void> {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    plugins: [configPlugin],
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    await callback(
      (await server.ssrLoadModule(CONFIG_MODULE_ID)) as ConfigModuleExports
    );
  } finally {
    await server.close();
  }
}

describe.sequential('gtTanstackStart config module', () => {
  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('exports gt.config.json without reloading it on change', async () => {
    const { configPlugin, root } = createProject({
      'gt.config.json': gtConfig(),
    });

    const { code, watchFiles } = await loadConfigModuleCode(configPlugin, root);

    expect(code).toContain(
      `export const config = ${JSON.stringify(JSON.parse(gtConfig()))};`
    );
    // SSR keeps its first GT config, so reloading only this module would
    // give the browser a config the server does not use.
    expect(watchFiles).toEqual([]);
  });

  it('leaves API keys out of the config module and warns', async () => {
    const { configPlugin, root } = createProject({
      'gt.config.json': JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        apiKey: 'SENTINEL_API',
        devApiKey: 'SENTINEL_DEV',
      }),
    });

    const { code, warnOnce } = await loadConfigModuleCode(configPlugin, root);

    // The same module is served to the browser.
    expect(code).not.toContain('SENTINEL_API');
    expect(code).not.toContain('SENTINEL_DEV');
    expect(code).toContain('"defaultLocale":"en"');
    expect(warnOnce).toHaveBeenCalledOnce();
    expect(warnOnce.mock.calls[0][0]).toContain(
      'gt.config.json contains an API key'
    );
  });

  it('generates the loader for each app root that shares a config', async () => {
    const withLoader = createProject({
      'gt.config.json': gtConfig('src/_gt/[locale].json'),
      'src/loadTranslations.ts': 'export default async () => ({});\n',
    });
    const withoutLoader = createProject(
      {},
      path.join(withLoader.root, 'gt.config.json')
    );

    const { code: custom } = await loadConfigModuleCode(
      withLoader.configPlugin,
      withLoader.root
    );
    const { code: generated } = await loadConfigModuleCode(
      withoutLoader.configPlugin,
      withoutLoader.root
    );

    expect(custom).toContain('/src/loadTranslations.ts');
    expect(generated).not.toContain('/src/loadTranslations.ts');
    expect(generated).toContain('import.meta.glob');
  });

  it('resolves the translation output from each working directory', async () => {
    const { configPlugin, root } = createProject({
      'gt.config.json': gtConfig('src/_gt/[locale].json'),
    });
    const cwd = vi
      .spyOn(process, 'cwd')
      .mockReturnValue(path.join(root, 'app'));
    const [nestedPlugin] = gtTanstackStart({
      config: path.join(root, 'gt.config.json'),
      experimentalCompilerOptions: { type: 'none' },
    });
    cwd.mockRestore();

    const { code: fromRoot } = await loadConfigModuleCode(configPlugin, root);
    const { code: fromApp } = await loadConfigModuleCode(nestedPlugin, root);

    expect(fromRoot).toContain('"/src/_gt/*.json"');
    expect(fromApp).toContain('"/app/src/_gt/*.json"');
  });

  it('keeps serving the first config for the rest of the process', async () => {
    const { configPlugin, root } = createProject({
      'gt.config.json': gtConfig(),
    });
    const { code: first } = await loadConfigModuleCode(configPlugin, root);
    fs.writeFileSync(
      path.join(root, 'gt.config.json'),
      JSON.stringify({ defaultLocale: 'en', locales: ['en', 'de'] })
    );

    const { code: reloaded } = await loadConfigModuleCode(configPlugin, root);
    // A Vite in-process restart creates a new plugin instance.
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
    const [restartedPlugin] = gtTanstackStart({
      experimentalCompilerOptions: { type: 'none' },
    });
    cwd.mockRestore();
    const { code: restarted } = await loadConfigModuleCode(
      restartedPlugin,
      root
    );

    expect(reloaded).toBe(first);
    expect(restarted).toBe(first);
  });

  it.each([
    { config: 'gt.config.json', changed: 'gt.config.json' },
    { config: 'config/gt.config.json', changed: 'config/gt.config.json' },
  ])(
    'warns that $changed changes need a dev server restart',
    ({ config, changed }) => {
      const { configPlugin, root } = createProject(
        { [config]: gtConfig() },
        config
      );
      const configFile = path.join(root, config);
      const add = vi.fn();
      const on = vi.fn();
      const warn = vi.fn();
      const configureServer = configPlugin.configureServer;
      if (typeof configureServer !== 'function') {
        throw new Error('Expected a configureServer hook');
      }

      configureServer.call(
        {} as ThisParameterType<typeof configureServer>,
        {
          watcher: { add, on },
          config: { logger: { warn } },
        } as unknown as Parameters<typeof configureServer>[0]
      );

      expect(add).toHaveBeenCalledWith(configFile);
      const [[event, onChange]] = on.mock.calls as [
        [string, (file: string) => void],
      ];
      expect(event).toBe('change');

      onChange(path.join(root, 'src/routes/index.tsx'));
      expect(warn).not.toHaveBeenCalled();

      onChange(configFile);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0][0]).toMatch(
        new RegExp(
          `^gt-tanstack-start Warning: ${changed} changed, but the running dev server keeps the version it read at startup\\.`
        )
      );
      expect(warn.mock.calls[0][0]).toContain(
        'Stop the dev server and start it again'
      );
    }
  );

  it('uses the CDN when gt.config.json has no local output', async () => {
    const { configPlugin, root } = createProject({
      'gt.config.json': gtConfig(),
    });

    const { code } = await loadConfigModuleCode(configPlugin, root);
    expect(code).toContain('export const loadTranslations = undefined;');

    await withConfigModule(configPlugin, root, async (module) => {
      expect(module.config).toEqual(JSON.parse(gtConfig()));
      expect(module.loadTranslations).toBeUndefined();
    });
  });

  it.each([
    {
      name: 'default export',
      file: 'src/loadTranslations.ts',
      source:
        'export default async (locale: string) => ({ from: "default", locale });',
      expected: { from: 'default', locale: 'fr' },
    },
    {
      name: 'named export',
      file: 'src/loadTranslations.js',
      source:
        'export async function loadTranslations(locale) { return { from: "named", locale }; }',
      expected: { from: 'named', locale: 'fr' },
    },
  ])(
    'prefers a custom loader $name over the local output',
    async ({ file, source, expected }) => {
      const { configPlugin, root } = createProject({
        'gt.config.json': gtConfig('src/_gt/[locale].json'),
        'src/_gt/fr.json': JSON.stringify({ from: 'output' }),
        [file]: source,
      });

      const { code } = await loadConfigModuleCode(configPlugin, root);
      expect(code).toContain(
        `import * as loadTranslationsModule from ${JSON.stringify(`/${file}`)};`
      );
      expect(code).not.toContain('import.meta.glob');

      await withConfigModule(configPlugin, root, async (module) => {
        await expect(module.loadTranslations?.('fr')).resolves.toEqual(
          expected
        );
      });
    }
  );

  it('reports a custom loader without a loadTranslations function', async () => {
    const { configPlugin, root } = createProject({
      'gt.config.json': gtConfig('src/_gt/[locale].json'),
      'src/_gt/fr.json': JSON.stringify({ from: 'output' }),
      'src/loadTranslations.ts': 'export const load = async () => ({});',
    });

    const loading = withConfigModule(configPlugin, root, async () => {});
    await expect(loading).rejects.toThrow(/^gt-tanstack-start Error: /);
    await expect(loading).rejects.toThrow('src/loadTranslations.ts');
    await expect(loading).rejects.toThrow(
      'export a default or named loadTranslations function'
    );
  });

  it.each([
    {
      name: 'a single [locale] placeholder',
      config: 'gt.config.json',
      output: 'src/_gt/[locale].json',
      file: 'src/_gt/fr.json',
      glob: '/src/_gt/*.json',
    },
    {
      name: 'repeated [locale] placeholders',
      config: 'gt.config.json',
      output: 'src/_gt/[locale]/[locale].json',
      file: 'src/_gt/fr/fr.json',
      glob: '/src/_gt/*/*.json',
    },
    {
      // The gt CLI resolves output from the working directory, not the config.
      name: 'a nested config path',
      config: 'config/gt.config.json',
      output: 'src/_gt/[locale].json',
      file: 'src/_gt/fr.json',
      glob: '/src/_gt/*.json',
    },
  ])(
    'loads local translations for $name',
    async ({ config, output, file, glob }) => {
      const { configPlugin, root } = createProject(
        {
          [config]: gtConfig(output),
          [file]: JSON.stringify({ hello: 'bonjour' }),
        },
        config
      );

      const { code } = await loadConfigModuleCode(configPlugin, root);
      expect(code).toContain(`import.meta.glob(${JSON.stringify(glob)}`);

      await withConfigModule(configPlugin, root, async (module) => {
        await expect(module.loadTranslations?.('fr')).resolves.toEqual({
          hello: 'bonjour',
        });
        await expect(module.loadTranslations?.('de')).resolves.toEqual({});
      });
    }
  );

  it('adds initializeGT settings from the plugin options over gt.config.json', async () => {
    const { configPlugin, root } = createProject(
      {
        'gt.config.json': JSON.stringify({
          defaultLocale: 'en',
          locales: ['en', 'fr'],
          cacheExpiryTime: 1000,
        }),
      },
      'gt.config.json',
      {
        localeCookieName: 'app.locale',
        cacheExpiryTime: null,
        batchConfig: { maxBatchSize: 5 },
        runtimeTranslation: { timeout: 2000 },
        regionCookieName: undefined,
      }
    );

    await withConfigModule(configPlugin, root, async (module) => {
      expect(module.config).toEqual({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        cacheExpiryTime: null,
        localeCookieName: 'app.locale',
        batchConfig: { maxBatchSize: 5 },
        runtimeTranslation: { timeout: 2000 },
      });
      expect(module.dictionary).toBeUndefined();
      expect(module.loadDictionary).toBeUndefined();
    });
  });

  it.each([
    {
      name: 'a default dictionary.json in the app root',
      files: { 'dictionary.json': '{"greeting":"Hello"}' },
      options: {},
    },
    {
      name: 'a default src/dictionary.ts named export',
      files: {
        'src/dictionary.ts': 'export const dictionary = { greeting: "Hello" };',
      },
      options: {},
    },
    {
      name: 'the dictionary option',
      files: {
        'i18n/messages.ts': 'export default { greeting: "Hello" };',
        'dictionary.json': '{"greeting":"ignored"}',
      },
      options: { dictionary: 'i18n/messages.ts' },
    },
  ])('exports $name', async ({ files, options }) => {
    const { configPlugin, root } = createProject(
      { 'gt.config.json': gtConfig(), ...files },
      'gt.config.json',
      options
    );

    await withConfigModule(configPlugin, root, async (module) => {
      expect(module.dictionary).toEqual({ greeting: 'Hello' });
    });
  });

  it.each([
    {
      name: 'a default src/loadDictionary.ts',
      files: {
        'src/loadDictionary.ts':
          'export default async (locale: string) => ({ locale });',
      },
      options: {},
    },
    {
      name: 'the loadDictionaryPath option',
      files: {
        'i18n/dictionaries.js':
          'export async function loadDictionary(locale) { return { locale }; }',
      },
      options: { loadDictionaryPath: 'i18n/dictionaries.js' },
    },
  ])('exports the dictionary loader from $name', async ({ files, options }) => {
    const { configPlugin, root } = createProject(
      { 'gt.config.json': gtConfig(), ...files },
      'gt.config.json',
      options
    );

    await withConfigModule(configPlugin, root, async (module) => {
      await expect(module.loadDictionary?.('fr')).resolves.toEqual({
        locale: 'fr',
      });
    });
  });

  it('prefers the loadTranslationsPath option over the default loader', async () => {
    const { configPlugin, root } = createProject(
      {
        'gt.config.json': gtConfig('src/_gt/[locale].json'),
        'src/loadTranslations.ts':
          'export default async () => ({ from: "default" });',
        'i18n/load.ts':
          'export const loadTranslations = async (locale: string) => ({ from: "option", locale });',
      },
      'gt.config.json',
      { loadTranslationsPath: 'i18n/load.ts' }
    );

    await withConfigModule(configPlugin, root, async (module) => {
      await expect(module.loadTranslations?.('fr')).resolves.toEqual({
        from: 'option',
        locale: 'fr',
      });
    });
  });

  it('reports a path option that names a missing file', async () => {
    const { configPlugin, root } = createProject(
      { 'gt.config.json': gtConfig() },
      'gt.config.json',
      { loadDictionaryPath: 'i18n/missing.ts' }
    );

    await expect(loadConfigModuleCode(configPlugin, root)).rejects.toThrow(
      /^gt-tanstack-start Error: The gtTanstackStart\(\) loadDictionaryPath option points to i18n\/missing\.ts, which does not exist/
    );
  });

  it('reports a dictionary file without a dictionary export', async () => {
    const { configPlugin, root } = createProject({
      'gt.config.json': gtConfig(),
      'src/dictionary.ts': 'export const messages = {};',
    });

    const loading = withConfigModule(configPlugin, root, async () => {});
    await expect(loading).rejects.toThrow(
      'src/dictionary.ts does not export a dictionary'
    );
    await expect(loading).rejects.toThrow(
      'export a default or named dictionary object'
    );
  });

  it('warns when a restart changes the plugin options it keeps serving', async () => {
    const { configPlugin, root } = createProject({
      'gt.config.json': gtConfig(),
    });
    const { code: first } = await loadConfigModuleCode(configPlugin, root);
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
    const [restartedPlugin] = gtTanstackStart({
      experimentalCompilerOptions: { type: 'none' },
      localeCookieName: 'app.locale',
    });
    cwd.mockRestore();

    const { code, warnOnce } = await loadConfigModuleCode(
      restartedPlugin,
      root
    );

    expect(code).toBe(first);
    expect(warnOnce).toHaveBeenCalledOnce();
    expect(warnOnce.mock.calls[0][0]).toContain(
      'The gtTanstackStart() options changed, but the running dev server keeps the version it read at startup'
    );
  });

  it('reports a malformed gt.config.json when the plugin is created', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-tanstack-start-'));
    tempDirs.push(root);
    const config = path.join(root, 'gt.config.json');
    fs.writeFileSync(config, '{ "locales": [');

    expect(() => gtTanstackStart({ config })).toThrow(
      /^gt-tanstack-start Error: .*gt\.config\.json/
    );
    expect(() => gtTanstackStart({ config })).toThrow(config);
  });

  it('reports a malformed gt.config.json when the config module loads', async () => {
    const { configPlugin, root } = createProject({
      'gt.config.json': gtConfig(),
    });
    const config = path.join(root, 'gt.config.json');
    fs.writeFileSync(config, '{ "locales": [');

    const loading = loadConfigModuleCode(configPlugin, root);
    await expect(loading).rejects.toThrow(/^gt-tanstack-start Error: /);
    await expect(loading).rejects.toThrow(config);
  });
});
