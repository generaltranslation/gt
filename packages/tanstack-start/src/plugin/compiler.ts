import fs from 'node:fs';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';
import { readConfigFile } from './configModule';
import {
  autoJsxInjectionCompilerWarning,
  compileTimeHashDisabledWarning,
  createCompilerUnresolvedWarning,
} from './diagnostics';
import type { GTTanstackStartCompilerOptions } from './types';

const NODE_MODULES_PATTERN = /[\\/]node_modules[\\/]/;

type CompilerVitePlugin = (options: Record<string, unknown>) => Plugin;

/** Which GT compiler the plugin runs, and where inserted JSX imports from. */
export type CompilerIntegration = {
  /** The compiler module that exports `vite`. */
  compilerModule: string;
  /** The import source of auto-inserted `<T>` and `<Var>`. */
  autoJsxImportSource: string;
};

export const DEFAULT_COMPILER_INTEGRATION: CompilerIntegration = {
  compilerModule: '@generaltranslation/compiler',
  autoJsxImportSource: 'gt-tanstack-start',
};

export function createCompilerPlugin(
  { type = 'none', ...compilerSettings }: GTTanstackStartCompilerOptions = {},
  configFile: string,
  integration: CompilerIntegration = DEFAULT_COMPILER_INTEGRATION
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

  // Loaded only when enabled, so apps that do not opt in never load Babel.
  let gtCompiler: CompilerVitePlugin;
  try {
    gtCompiler = createRequire(import.meta.url)(
      integration.compilerModule
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
    autoJsxImportSource: integration.autoJsxImportSource,
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
