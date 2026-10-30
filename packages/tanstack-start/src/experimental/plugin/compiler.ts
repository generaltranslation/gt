import fs from 'node:fs';
import { createRequire } from 'node:module';
import { isLocaleTwinsSplitting } from 'generaltranslation/internal/experimental';
import type { GTExperimentalSettings } from 'generaltranslation/internal/experimental';
import type { Plugin } from 'vite';
import { readConfigFile } from '../../plugin/configModule';
import {
  autoJsxInjectionCompilerWarning,
  compileTimeHashDisabledWarning,
  createCompilerUnresolvedWarning,
} from '../../plugin/diagnostics';
import type { GTTanstackStartCompilerOptions } from './types';

const NODE_MODULES_PATTERN = /[\\/]node_modules[\\/]/;

type CompilerVitePlugin = (options: Record<string, unknown>) => Plugin;

/**
 * The compiler plugin with locale twins: a copy of `plugin/compiler.ts` (keep
 * in sync) that runs `@generaltranslation/compiler/experimental` and inserts
 * JSX from `gt-tanstack-start/experimental`. `localeTwins` is whether the
 * build generates locale twins: the compiler runs and gt.config.json sets
 * `experimental.splitting` to `"locale-twins"`.
 */
export function createCompilerPlugin(
  { type = 'none', ...compilerSettings }: GTTanstackStartCompilerOptions = {},
  configFile: string
): {
  compilerPlugin: Plugin | undefined;
  localeTwins: boolean;
  warnings: string[];
} {
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
  if (!enabled) {
    return { compilerPlugin: undefined, localeTwins: false, warnings };
  }

  // Loaded only when enabled, so apps that do not opt in never load Babel.
  let gtCompiler: CompilerVitePlugin;
  try {
    gtCompiler = createRequire(import.meta.url)(
      '@generaltranslation/compiler/experimental'
    ).vite;
  } catch (error) {
    warnings.push(createCompilerUnresolvedWarning(error));
    return { compilerPlugin: undefined, localeTwins: false, warnings };
  }

  // The compiler spreads options over its defaults, so an explicit undefined
  // would erase a default.
  const definedSettings = Object.fromEntries(
    Object.entries(compilerSettings).filter(([, value]) => value !== undefined)
  );

  const plugin = gtCompiler({
    ...definedSettings,
    ...(gtConfig ? { gtConfig } : {}),
    autoJsxImportSource: 'gt-tanstack-start/experimental',
  });

  return {
    compilerPlugin: adaptCompilerPlugin(plugin),
    // The compiler's own splitting option overrides gt.config.json
    localeTwins: isLocaleTwinsSplitting(
      (compilerSettings as { splitting?: string }).splitting ??
        (gtConfig as GTExperimentalSettings | undefined)?.experimental
          ?.splitting
    ),
    warnings,
  };
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
 * such as `index.tsx?tsr-split=component`, and code shared by several split
 * groups into `index.tsx?tsr-shared=1`. The compiler only accepts ids that end
 * in a source extension, so it gets the file path for those modules. Other
 * query ids (?raw, ?url, ...) stay unchanged and are skipped by the compiler.
 */
function getCompilerId(id: string): string {
  const queryStart = id.indexOf('?');
  if (queryStart === -1) return id;
  const query = new URLSearchParams(id.slice(queryStart + 1));
  return query.has('tsr-split') || query.has('tsr-shared')
    ? id.slice(0, queryStart)
    : id;
}
