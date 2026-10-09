import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import type { GTCompilerOptions, GTConfig } from 'generaltranslation/types';
import type { Logger, Plugin } from 'vite';
import type { InitializeGTParams } from '../types/InitializeGTParams';

/** Mirrors gt-next's withGTConfig experimentalCompilerOptions. */
export type GTTanstackStartCompilerOptions = GTCompilerOptions & {
  /**
   * Which compiler plugin to use: babel or none. 'babel' requires
   * @generaltranslation/compiler to be installed.
   * @default 'none'
   */
  type?: 'babel' | 'none';
};

/**
 * initializeGT() settings that gt.config.json cannot hold. They override
 * gt.config.json, as withGTConfig() options do in gt-next.
 */
export type GTTanstackStartRuntimeOptions = Pick<
  InitializeGTParams,
  | 'localeCookieName'
  | 'regionCookieName'
  | 'enableI18nCookieName'
  | 'cacheExpiryTime'
  | 'batchConfig'
  | 'runtimeTranslation'
>;

export type GTTanstackStartPluginOptions = GTTanstackStartRuntimeOptions & {
  /** Path to gt.config.json, relative to the current working directory. */
  config?: string;
  /**
   * Path to a dictionary file with a default or named `dictionary` export,
   * relative to the current working directory. Defaults to `dictionary.ts`,
   * `.js` or `.json` in the app root or `src/`, as in gt-next.
   */
  dictionary?: string;
  /**
   * Path to a file with a default or named `loadDictionary` function, relative
   * to the current working directory. Defaults to `loadDictionary.ts` or `.js`
   * in the app root or `src/`, as in gt-next.
   */
  loadDictionaryPath?: string;
  /**
   * Path to a file with a default or named `loadTranslations` function,
   * relative to the current working directory. Defaults to
   * `src/loadTranslations.*`, then to the files.gt.output pattern of
   * gt.config.json.
   */
  loadTranslationsPath?: string;
  experimentalCompilerOptions?: GTTanstackStartCompilerOptions;
};

type ConfigModuleOptions = Omit<
  GTTanstackStartPluginOptions,
  'config' | 'experimentalCompilerOptions'
>;

const CONFIG_MODULE_ID = 'gt-tanstack-start/internal/_config';
const RESOLVED_CONFIG_MODULE_ID = '\0gt-tanstack-start:config';
const CUSTOM_LOADER_FILES = [
  'src/loadTranslations.ts',
  'src/loadTranslations.tsx',
  'src/loadTranslations.js',
  'src/loadTranslations.jsx',
];
const DICTIONARY_FILES = ['', 'src/'].flatMap((directory) =>
  ['.ts', '.js', '.json'].map(
    (extension) => `${directory}dictionary${extension}`
  )
);
const DICTIONARY_LOADER_FILES = ['', 'src/'].flatMap((directory) =>
  ['.ts', '.js'].map((extension) => `${directory}loadDictionary${extension}`)
);
const NODE_MODULES_PATTERN = /[\\/]node_modules[\\/]/;

// GT's server state is a first-write-wins global that outlives Vite module
// reloads and in-process restarts, so the config module is generated once per
// process too. Any later read could hand the browser settings SSR never applied.
// Keyed by app root and working directory too: the loader depends on both.
// The options it was generated with are kept to warn when a restart with
// other options keeps serving it.
const configModules = ((
  globalThis as {
    __gtTanstackStartConfigModules?: Map<
      string,
      { code: string; options: string }
    >;
  }
).__gtTanstackStartConfigModules ??= new Map());

const compileTimeHashDisabledWarning = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Warning',
  whatHappened: 'Compile-time hashing is disabled',
  wayOut:
    'The GT compiler will not run, so compiler optimizations are inactive',
});

const autoJsxInjectionCompilerWarning = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Warning',
  whatHappened: 'Automatic JSX injection requires the GT compiler',
  wayOut: 'Automatic JSX injection will be skipped',
  fix: "Set experimentalCompilerOptions.type to 'babel' and keep compileTimeHash enabled in gtTanstackStart()",
});

function createCompilerUnresolvedWarning(error: unknown): string {
  return createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Warning',
    whatHappened: 'The GT babel compiler could not be resolved',
    wayOut: 'Skipping compiler optimizations',
    fix: 'Install @generaltranslation/compiler to enable the experimental babel compiler',
    details: formatDiagnosticErrorDetails(error),
  });
}

const duplicateCompilerWarning = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Warning',
  whatHappened: 'The GT compiler plugin is registered more than once',
  why: 'gtTanstackStart() already includes the GT compiler',
  fix: 'Remove the separate GT compiler plugin from your Vite plugins',
  wayOut: "set experimentalCompilerOptions.type to 'none' in gtTanstackStart()",
});

function createInvalidExportError(
  file: string,
  what: string,
  expected: string
): string {
  return createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Error',
    whatHappened: `${file} does not export ${what}`,
    fix: `In that file, export a default or named ${expected}`,
  });
}

function createMissingFileError(option: string, file: string): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt-tanstack-start',
      severity: 'Error',
      whatHappened: `The gtTanstackStart() ${option} option points to ${file}, which does not exist`,
      fix: `Create the file, or set ${option} to its path relative to the working directory`,
    })
  );
}

function createConfigChangedWarning(configFileName: string): string {
  return createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Warning',
    whatHappened: `${configFileName} changed, but the running dev server keeps the version it read at startup`,
    fix: 'Stop the dev server and start it again to apply the change',
  });
}

function createApiKeysOmittedWarning(configFileName: string): string {
  return createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Warning',
    whatHappened: `${configFileName} contains an API key, which gtTanstackStart() leaves out of the generated config so it is not published to the browser`,
    fix: 'Remove apiKey and devApiKey from the file and set GT_API_KEY or VITE_GT_DEV_API_KEY in the environment instead',
  });
}

function createConfigReadError(configFile: string, error: unknown): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt-tanstack-start',
      severity: 'Error',
      whatHappened: 'Failed to read gt.config.json',
      fix: 'Check that the file exists and contains valid JSON, or point the gtTanstackStart() config option at it',
      details: [configFile, formatDiagnosticErrorDetails(error)].filter(
        (detail): detail is string => detail !== undefined
      ),
    })
  );
}

type CompilerVitePlugin = (options: Record<string, unknown>) => Plugin;

function readConfigFile(configFile: string): GTConfig {
  try {
    return JSON.parse(fs.readFileSync(configFile, 'utf8')) as GTConfig;
  } catch (error) {
    throw createConfigReadError(configFile, error);
  }
}

/**
 * Supplies gt-tanstack-start with the app's gt.config.json and translation
 * loader, so the app does not call initializeGT() or write a loader, and runs
 * the experimental GT compiler on the app's source when enabled.
 *
 * TanStack Start already processes gt-tanstack-start through Vite (it is
 * ssr.noExternal and excluded from dep optimization because it peer-depends on
 * @tanstack/react-start), so its internal config import resolves here.
 */
export function gtTanstackStart(
  options: GTTanstackStartPluginOptions = {}
): Plugin[] {
  // Resolved at factory time because the compiler needs the parsed config
  // before Vite resolves its root. Both plugins read this same file; the
  // compiler keeps its factory-time snapshot until Vite restarts.
  // files.gt.output also resolves from here, matching the gt CLI.
  const cwd = process.cwd();
  const {
    config,
    experimentalCompilerOptions,
    ...configModuleOptions
  }: GTTanstackStartPluginOptions = options;
  const configFile = path.resolve(cwd, config ?? 'gt.config.json');
  const { compilerPlugin, warnings } = createCompilerPlugin(
    experimentalCompilerOptions,
    configFile
  );
  const moduleOptions = JSON.stringify(configModuleOptions);
  let root = cwd;
  let logger: Logger | undefined;

  const configPlugin: Plugin = {
    name: 'gt-tanstack-start',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
      logger = config.logger;
      for (const warning of warnings) config.logger.warnOnce(warning);
      if (
        compilerPlugin &&
        config.plugins.filter((plugin) => plugin.name === compilerPlugin.name)
          .length > 1
      ) {
        config.logger.warnOnce(duplicateCompilerWarning);
      }
    },
    configureServer(server) {
      // The config module is a per-process snapshot (see configModules), so
      // edits only apply after a process restart; say so instead of failing
      // silently.
      const configChangedWarning = createConfigChangedWarning(
        path.relative(cwd, configFile)
      );
      server.watcher.add(configFile);
      server.watcher.on('change', (file) => {
        if (path.resolve(file) === configFile) {
          server.config.logger.warn(configChangedWarning);
        }
      });
    },
    resolveId(id) {
      if (id === CONFIG_MODULE_ID) return RESOLVED_CONFIG_MODULE_ID;
    },
    load(id) {
      if (id !== RESOLVED_CONFIG_MODULE_ID) return;
      const key = JSON.stringify([root, cwd, configFile]);
      const cached = configModules.get(key);
      if (cached) {
        if (cached.options !== moduleOptions) {
          logger?.warnOnce(
            createConfigChangedWarning('The gtTanstackStart() options')
          );
        }
        return cached.code;
      }
      const configModule = createConfigModule(
        root,
        cwd,
        configFile,
        configModuleOptions
      );
      configModules.set(key, {
        code: configModule.code,
        options: moduleOptions,
      });
      if (configModule.omittedApiKeys) {
        logger?.warnOnce(
          createApiKeysOmittedWarning(path.relative(cwd, configFile))
        );
      }
      return configModule.code;
    },
  };

  return compilerPlugin ? [configPlugin, compilerPlugin] : [configPlugin];
}

function createCompilerPlugin(
  { type = 'none', ...compilerSettings }: GTTanstackStartCompilerOptions = {},
  configFile: string
): { compilerPlugin: Plugin | undefined; warnings: string[] } {
  const warnings: string[] = [];
  if (compilerSettings.compileTimeHash === false) {
    warnings.push(compileTimeHashDisabledWarning);
  }
  const enabled =
    type === 'babel' && compilerSettings.compileTimeHash !== false;
  const gtConfig = fs.existsSync(configFile)
    ? readConfigFile(configFile)
    : undefined;
  // The gt CLI extracts auto-injected JSX when gt.config.json enables it, so
  // those translations only resolve if the compiler injects the same JSX.
  const autoJsxInjection =
    compilerSettings.enableAutoJsxInjection ??
    gtConfig?.files?.gt?.parsingFlags?.enableAutoJsxInjection;
  if (autoJsxInjection && !enabled) {
    warnings.push(autoJsxInjectionCompilerWarning);
  }
  if (!enabled) return { compilerPlugin: undefined, warnings };

  // Loaded only when enabled: the compiler is an optional peer dependency,
  // as in gt-next, so apps that do not opt in skip installing Babel.
  let gtCompiler: CompilerVitePlugin;
  try {
    gtCompiler = createRequire(import.meta.url)(
      '@generaltranslation/compiler'
    ).vite;
  } catch (error) {
    warnings.push(createCompilerUnresolvedWarning(error));
    return { compilerPlugin: undefined, warnings };
  }

  // The compiler spreads options over its defaults, so an explicit undefined
  // would erase a default.
  const definedSettings = Object.fromEntries(
    Object.entries(compilerSettings).filter(([, value]) => value !== undefined)
  );

  const plugin = gtCompiler({
    ...definedSettings,
    ...(gtConfig ? { gtConfig } : {}),
    autoJsxImportSource: 'gt-tanstack-start',
  });

  return { compilerPlugin: adaptCompilerPlugin(plugin), warnings };
}

/**
 * Skips node_modules: the compiler transforms every .js/.ts/.jsx/.tsx module,
 * so it would otherwise parse dependencies with Babel. The hook filter lets
 * Vite skip the call entirely; the handler check covers Vite versions without
 * hook filters.
 */
function adaptCompilerPlugin(plugin: Plugin): Plugin {
  const transform = plugin.transform;
  if (!transform) return plugin;
  const handler =
    typeof transform === 'function' ? transform : transform.handler;
  return {
    ...plugin,
    transform: {
      filter: { id: { exclude: NODE_MODULES_PATTERN } },
      handler(code, id, transformOptions) {
        if (NODE_MODULES_PATTERN.test(id)) return null;
        return handler.call(this, code, getCompilerId(id), transformOptions);
      },
    },
  };
}

/**
 * TanStack Router code-splitting moves route components into virtual modules
 * such as `index.tsx?tsr-split=component`. The compiler only accepts ids that
 * end in a source extension, so it gets the file path for those modules. Other
 * query ids (?raw, ?url, ...) stay unchanged and are skipped by the compiler.
 */
function getCompilerId(id: string): string {
  const queryStart = id.indexOf('?');
  if (queryStart === -1) return id;
  const query = new URLSearchParams(id.slice(queryStart + 1));
  return query.has('tsr-split') ? id.slice(0, queryStart) : id;
}

/**
 * The file an option names, relative to the working directory, or else the
 * first default that exists, relative to the app root.
 */
function findModuleFile(
  root: string,
  cwd: string,
  option: string,
  configured: string | undefined,
  defaults: string[]
): string | undefined {
  if (configured !== undefined) {
    const file = path.resolve(cwd, configured);
    if (!fs.existsSync(file)) throw createMissingFileError(option, configured);
    return file;
  }
  return defaults
    .map((file) => path.join(root, file))
    .find((file) => fs.existsSync(file));
}

/**
 * Exports `name` from the file's default or named export, failing loudly
 * when neither exists: a fallback would silently drop the app's setting.
 */
function exportFromFile(
  root: string,
  file: string,
  name: string,
  type: 'function' | 'object',
  what: string
): string[] {
  const relative = path.relative(root, file).split(path.sep).join('/');
  const local = `${name}Module`;
  return [
    `import * as ${local} from ${JSON.stringify(`/${relative}`)};`,
    `const ${name} = ${local}.default ?? ${local}.${name};`,
    `if (typeof ${name} !== '${type}' || ${name} === null) {`,
    `  throw new Error(${JSON.stringify(createInvalidExportError(relative, what, type === 'function' ? `${name} function` : `${name} object`))});`,
    '}',
    `export { ${name} };`,
  ];
}

function createConfigModule(
  root: string,
  cwd: string,
  configFile: string,
  {
    dictionary,
    loadDictionaryPath,
    loadTranslationsPath,
    ...runtimeOptions
  }: ConfigModuleOptions
): { code: string; omittedApiKeys: boolean } {
  const config = readConfigFile(configFile);
  // The browser imports this module too, so credentials must never be in it.
  const { apiKey, devApiKey, ...publicConfig } = config;
  // An explicit undefined would erase the gt.config.json value.
  const definedRuntimeOptions = Object.fromEntries(
    Object.entries(runtimeOptions).filter(([, value]) => value !== undefined)
  );
  const lines = [
    `export const config = ${JSON.stringify({ ...publicConfig, ...definedRuntimeOptions })};`,
  ];

  const dictionaryFile = findModuleFile(
    root,
    cwd,
    'dictionary',
    dictionary,
    DICTIONARY_FILES
  );
  lines.push(
    ...(dictionaryFile
      ? exportFromFile(
          root,
          dictionaryFile,
          'dictionary',
          'object',
          'a dictionary'
        )
      : ['export const dictionary = undefined;'])
  );
  const dictionaryLoader = findModuleFile(
    root,
    cwd,
    'loadDictionaryPath',
    loadDictionaryPath,
    DICTIONARY_LOADER_FILES
  );
  lines.push(
    ...(dictionaryLoader
      ? exportFromFile(
          root,
          dictionaryLoader,
          'loadDictionary',
          'function',
          'a dictionary loader'
        )
      : ['export const loadDictionary = undefined;'])
  );

  const customLoader = findModuleFile(
    root,
    cwd,
    'loadTranslationsPath',
    loadTranslationsPath,
    CUSTOM_LOADER_FILES
  );
  const output = config.files?.gt?.output;

  if (customLoader) {
    lines.push(
      ...exportFromFile(
        root,
        customLoader,
        'loadTranslations',
        'function',
        'a translation loader'
      )
    );
  } else if (output?.includes('[locale]')) {
    const pattern = `/${path
      .relative(root, path.resolve(cwd, output))
      .split(path.sep)
      .join('/')}`;
    // Like the gt CLI, replace every placeholder.
    const segments = pattern.split('[locale]');
    lines.push(
      `const files = import.meta.glob(${JSON.stringify(segments.join('*'))}, { import: 'default' });`,
      'export async function loadTranslations(locale) {',
      `  const load = files[${segments.map((segment) => JSON.stringify(segment)).join(' + locale + ')}];`,
      '  return load ? load() : {};',
      '}'
    );
  } else {
    // No local translations: GT loads from the CDN.
    lines.push('export const loadTranslations = undefined;');
  }

  return {
    code: lines.join('\n'),
    omittedApiKeys: apiKey !== undefined || devApiKey !== undefined,
  };
}
