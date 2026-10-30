/**
 * `gt-tanstack-start/experimental/plugin/vite`: `gtTanstackStart()` for apps
 * that use experimental locale twins (`experimental.splitting:
 * "locale-twins"` in gt.config.json). It runs the experimental GT compiler
 * (`@generaltranslation/compiler/experimental`, enable it with
 * `experimentalCompilerOptions: { type: 'babel' }`), inserts JSX from
 * `gt-tanstack-start/experimental`, and keeps whole-locale translation files
 * out of the production client build. A copy of `plugin/vite.ts` (keep in
 * sync).
 */
import path from 'node:path';
import type { Logger, Plugin } from 'vite';
import { createCompilerPlugin } from './compiler';
import {
  CONFIG_MODULE_ID,
  LOCALE_ROUTING_MODULE_ID,
  RESOLVED_CONFIG_MODULE_ID,
  createConfigModule,
} from '../../plugin/configModule';
import {
  createApiKeysOmittedWarning,
  createConfigChangedWarning,
  duplicateCompilerWarning,
} from '../../plugin/diagnostics';
import type { GTTanstackStartPluginOptions } from './types';

export type {
  GTTanstackStartCompilerOptions,
  GTTanstackStartPluginOptions,
} from './types';
export type { GTTanstackStartRuntimeOptions } from '../../plugin/types';

const LOADER_START = 'export async function loadTranslations(locale) {\n';
const NO_DICTIONARY = 'export const dictionary = undefined;';

/**
 * Locale twins carry the browser's translations in the build, so only the
 * server loads whole locales. The constant condition lets the production
 * client build drop every locale file. Dictionary entries are never twinned,
 * so an app with a dictionary keeps loading them.
 */
export function loadTranslationsOnlyOnServer(code: string): string {
  if (!code.includes(NO_DICTIONARY)) return code;
  return code.replace(
    LOADER_START,
    `${LOADER_START}  if (import.meta.env.PROD && !import.meta.env.SSR) return {};\n`
  );
}

// GT's server state is a first-write-wins global that outlives Vite module
// reloads and in-process restarts, so in dev the config module is generated
// once per process too. Builds read the config fresh. Any later read could hand the browser settings SSR never applied.
// Keyed by app root and working directory too: the loader depends on both.
// The options it was generated with are kept to warn when a restart with
// other options keeps serving it.
const configModules = ((
  globalThis as {
    __gtTanstackStartConfigModules?: Map<
      string,
      { code: string; localeRouting: boolean; options: string }
    >;
  }
).__gtTanstackStartConfigModules ??= new Map());

/**
 * Supplies gt-tanstack-start with the app's gt.config.json and translation
 * loader, so the app does not write a loader, and runs
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
  let isServe = false;

  // The config module and the locale routing redirect read the same snapshot,
  // so the browser never gets routing code SSR isn't using.
  function getConfigModule() {
    const key = JSON.stringify([root, cwd, configFile]);
    const cached = isServe ? configModules.get(key) : undefined;
    if (cached) {
      if (cached.options !== moduleOptions) {
        logger?.warnOnce(
          createConfigChangedWarning('The gtTanstackStart() options')
        );
      }
      return cached;
    }
    const {
      code: regularCode,
      localeRouting,
      omittedApiKeys,
    } = createConfigModule(root, cwd, configFile, configModuleOptions);
    const code = loadTranslationsOnlyOnServer(regularCode);
    if (omittedApiKeys) {
      logger?.warnOnce(
        createApiKeysOmittedWarning(path.relative(cwd, configFile))
      );
    }
    const configModule = { code, localeRouting, options: moduleOptions };
    if (isServe) configModules.set(key, configModule);
    return configModule;
  }

  const configPlugin: Plugin = {
    name: 'gt-tanstack-start',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
      logger = config.logger;
      isServe = config.command === 'serve';
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
    resolveId(id, importer) {
      if (id === CONFIG_MODULE_ID) return RESOLVED_CONFIG_MODULE_ID;
      if (id === LOCALE_ROUTING_MODULE_ID) {
        // Only apps that enable locale routing bundle its browser code.
        const state = getConfigModule().localeRouting ? 'enabled' : 'disabled';
        return this.resolve(`${LOCALE_ROUTING_MODULE_ID}.${state}`, importer, {
          skipSelf: true,
        });
      }
    },
    load(id) {
      if (id === RESOLVED_CONFIG_MODULE_ID) return getConfigModule().code;
    },
  };

  return compilerPlugin ? [configPlugin, compilerPlugin] : [configPlugin];
}
