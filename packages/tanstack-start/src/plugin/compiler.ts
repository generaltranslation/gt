import fs from 'node:fs';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';
import { readConfigFile } from './configModule';
import {
  autoJsxInjectionCompilerWarning,
  createCompilerUnresolvedWarning,
} from './diagnostics';
import type { GTTanstackStartCompilerOptions } from './types';

const NODE_MODULES_PATTERN = /[\\/]node_modules[\\/]/;

// A build that splits translations is two plugins
type CompilerVitePlugin = (
  options: Record<string, unknown>
) => Plugin | Plugin[];

export function createCompilerPlugin(
  { type = 'none', ...compilerSettings }: GTTanstackStartCompilerOptions = {},
  configFile: string
): { compilerPlugin: Plugin[] | undefined; warnings: string[] } {
  const warnings: string[] = [];
  const enabled = type === 'babel';
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

  // `firstVisit` is this package's key, not the compiler's
  const { experimentalSplitTranslations: split, ...rest } = definedSettings as {
    experimentalSplitTranslations?: { firstVisit?: unknown };
  };
  const { firstVisit: _firstVisit, ...compilerSplit } = split ?? {};
  const plugin = gtCompiler({
    ...rest,
    ...(split && { experimentalSplitTranslations: compilerSplit }),
    ...(gtConfig ? { gtConfig } : {}),
    autoJsxImportSource: 'gt-tanstack-start',
    _splitTranslationsLoader: 'gt-tanstack-start/chunk-translations',
  });

  return {
    compilerPlugin: [plugin].flat().map(adaptCompilerPlugin),
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

// The queries of the virtual modules TanStack Router and Start move app code into
const COMPILED_QUERIES = ['tsr-split', 'tsr-shared', 'tss-serverfn-split'];

/**
 * TanStack Router code-splitting moves route components into virtual modules
 * such as `index.tsx?tsr-split=component`, and code shared by several split
 * groups into `index.tsx?tsr-shared=1`. TanStack Start moves the handler of a
 * server function, with what only it uses, into `index.tsx?tss-serverfn-split`.
 * The compiler only accepts ids that end in a source extension, so it gets
 * the file path for those modules. Other query ids (?raw, ?url, ...) stay
 * unchanged and are skipped by the compiler.
 */
function getCompilerId(id: string): string {
  const queryStart = id.indexOf('?');
  if (queryStart === -1) return id;
  const query = new URLSearchParams(id.slice(queryStart + 1));
  return COMPILED_QUERIES.some((name) => query.has(name))
    ? id.slice(0, queryStart)
    : id;
}
