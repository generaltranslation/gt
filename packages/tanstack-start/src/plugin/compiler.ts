import fs from 'node:fs';
import { createRequire } from 'node:module';
import type * as Compiler from '@generaltranslation/compiler';
import { splitTranslationsEnvNames } from 'generaltranslation/internal';
import type { Plugin } from 'vite';
import { readConfigFile } from './configModule';
import {
  autoJsxInjectionCompilerWarning,
  createCompilerUnresolvedWarning,
  splitRequiresCompilerError,
} from './diagnostics';
import {
  createSplitPlugin,
  resolveSplitTranslationsOptions,
} from './splitTranslations';
import type { GTTanstackStartCompilerOptions } from './types';

const NODE_MODULES_PATTERN = /[\\/]node_modules[\\/]/;

type CompilerModule = {
  // A build that splits translations is two plugins
  vite: (options: Compiler.GTUnpluginOptions) => Plugin | Plugin[];
  isSplitTranslationsEnabled: typeof Compiler.isSplitTranslationsEnabled;
};

/**
 * The compiler's plugins, when the compiler is on: with `type: 'babel'`, or
 * without a `type` when `experimentalSplitTranslations` is on, which only
 * the compiler does. With them, what a build that splits translations adds.
 */
export function createCompilerPlugin(
  { type, ...compilerSettings }: GTTanstackStartCompilerOptions = {},
  configFile: string
): {
  compilerPlugin: Plugin[] | undefined;
  split: ReturnType<typeof createSplitPlugin> | undefined;
  warnings: string[];
} {
  const warnings: string[] = [];
  const gtConfig = fs.existsSync(configFile)
    ? readConfigFile(configFile)
    : undefined;
  const none = () => {
    // The gt CLI extracts auto-injected JSX when gt.config.json enables it, so
    // those translations only resolve if the compiler injects the same JSX.
    const autoJsxInjection =
      compilerSettings.enableAutoJsxInjection ??
      gtConfig?.files?.gt?.parsingFlags?.enableAutoJsxInjection;
    if (autoJsxInjection) warnings.push(autoJsxInjectionCompilerWarning);
    return { compilerPlugin: undefined, split: undefined, warnings };
  };
  const splitOptions = compilerSettings.experimentalSplitTranslations;
  // The compiler decides whether the split is on. It is asked only when the
  // app names the split, so apps that do not opt in never load Babel.
  const maySplit =
    splitOptions !== undefined ||
    Boolean(process.env[splitTranslationsEnvNames.enabled]);
  if (type !== 'babel' && !maySplit) return none();

  let compiler: CompilerModule;
  try {
    compiler = createRequire(import.meta.url)('@generaltranslation/compiler');
  } catch (error) {
    warnings.push(createCompilerUnresolvedWarning(error));
    return { compilerPlugin: undefined, split: undefined, warnings };
  }
  const splits = compiler.isSplitTranslationsEnabled(splitOptions);
  if (splits && type === 'none') throw new Error(splitRequiresCompilerError);
  if (type !== 'babel' && !splits) return none();
  const split = splits ? createSplitPlugin() : undefined;

  // The compiler spreads options over its defaults, so an explicit undefined
  // would erase a default.
  const definedSettings = Object.fromEntries(
    Object.entries(compilerSettings).filter(([, value]) => value !== undefined)
  );

  const plugin = compiler.vite({
    ...definedSettings,
    ...(split && {
      experimentalSplitTranslations:
        resolveSplitTranslationsOptions(splitOptions),
      splitTranslationsHost: split.host,
    }),
    ...(gtConfig ? { gtConfig } : {}),
    autoJsxImportSource: 'gt-tanstack-start',
  });

  return {
    compilerPlugin: [plugin].flat().map(adaptCompilerPlugin),
    split,
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
