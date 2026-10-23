import path from 'node:path';
import type { Logger, Plugin } from 'vite';
import { createCompilerPlugin } from './compiler';
import {
  CONFIG_MODULE_ID,
  RESOLVED_CONFIG_MODULE_ID,
  createConfigModule,
} from './configModule';
import {
  createApiKeysOmittedWarning,
  createConfigChangedWarning,
  duplicateCompilerWarning,
} from './diagnostics';
import type { GTTanstackStartPluginOptions } from './types';

export type {
  GTTanstackStartCompilerOptions,
  GTTanstackStartPluginOptions,
  GTTanstackStartRuntimeOptions,
} from './types';

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
      { code: string; options: string }
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
    resolveId(id) {
      if (id === CONFIG_MODULE_ID) return RESOLVED_CONFIG_MODULE_ID;
    },
    load(id) {
      if (id !== RESOLVED_CONFIG_MODULE_ID) return;
      const key = JSON.stringify([root, cwd, configFile]);
      const cached = isServe ? configModules.get(key) : undefined;
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
      if (isServe) {
        configModules.set(key, {
          code: configModule.code,
          options: moduleOptions,
        });
      }
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
