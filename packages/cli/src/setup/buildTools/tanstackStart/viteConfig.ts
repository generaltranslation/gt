// vite.config.*: the gtTanstackStart plugin in defineConfig's plugins.
import * as t from '@babel/types';
import path from 'node:path';
import type { BuildToolContext, ManualAction } from '../index.js';
import {
  getLocalImport,
  getPropertyName,
  type SourceFile,
} from '../shared/source.js';
import {
  addVitePluginCall,
  collectPluginCalls,
  findPluginsArray,
  findVitePluginCalls,
  type VitePlugin,
} from '../shared/viteConfig.js';
import { DOCS_URL, VITE_PLUGIN_SOURCE } from './source.js';

const VITE_PLUGIN = 'gtTanstackStart';
const TANSTACK_PLUGIN: VitePlugin = {
  name: VITE_PLUGIN,
  source: VITE_PLUGIN_SOURCE,
};
const START_PLUGIN = 'tanstackStart';
const START_PLUGIN_SOURCE = '@tanstack/react-start/plugin/vite';
// The plugin reads this config path, relative to the working directory, by default.
const VITE_PLUGIN_DEFAULT_CONFIG = 'gt.config.json';

export function registersVitePlugin(viteConfig: SourceFile): boolean {
  return findVitePluginCalls(viteConfig, TANSTACK_PLUGIN).length > 0;
}

/**
 * The value `name` gets at runtime: undefined when no property sets it, or
 * null when a later spread or computed key might.
 */
function findPropertyValue(
  object: t.ObjectExpression,
  name: string
): t.Node | null | undefined {
  for (let i = object.properties.length - 1; i >= 0; i--) {
    const property = object.properties[i];
    const key = getPropertyName(property);
    if (key === undefined) return null;
    if (key === name) {
      return property.type === 'ObjectProperty' ? property.value : null;
    }
  }
  return undefined;
}

/**
 * Whether the exported config's tanstackStart() call enables SPA mode. Start
 * enables it once `spa` is set, unless `spa.enabled` is false. Values or
 * spreads GT cannot read count as not enabled, since most apps are not SPAs.
 */
export function enablesSpaMode(viteConfig: SourceFile): boolean {
  const local = getLocalImport(viteConfig, START_PLUGIN, START_PLUGIN_SOURCE);
  const plugins =
    viteConfig.statements && findPluginsArray(viteConfig.statements);
  if (local === undefined || plugins === undefined) return false;
  return collectPluginCalls(plugins.elements, local).some((call) => {
    const [options] = call.arguments;
    if (options?.type !== 'ObjectExpression') return false;
    const spa = findPropertyValue(options, 'spa');
    if (spa?.type !== 'ObjectExpression') return false;
    const enabled = findPropertyValue(spa, 'enabled');
    return (
      enabled === undefined || t.isBooleanLiteral(enabled, { value: true })
    );
  });
}

/**
 * A string option of a plugin call: undefined when it is not passed, or null
 * when only runtime values such as an environment variable or a spread could
 * tell.
 */
function getStaticPluginOption(
  call: t.CallExpression,
  name: string
): string | null | undefined {
  if (call.arguments.length === 0) return undefined;
  const [options] = call.arguments;
  if (call.arguments.length !== 1 || options.type !== 'ObjectExpression') {
    return null;
  }
  const names = options.properties.map(getPropertyName);
  if (names.includes(undefined)) return null;
  // The last duplicate key wins at runtime.
  const index = names.lastIndexOf(name);
  if (index === -1) return undefined;
  const option = options.properties[index];
  return option.type === 'ObjectProperty' &&
    option.value.type === 'StringLiteral'
    ? option.value.value
    : null;
}

/**
 * The config path a plugin call reads, or undefined when only runtime values
 * could tell.
 */
function getStaticPluginConfig(call: t.CallExpression): string | undefined {
  const config = getStaticPluginOption(call, 'config');
  return config === null ? undefined : (config ?? VITE_PLUGIN_DEFAULT_CONFIG);
}

/**
 * The loadTranslationsPath the registered plugin gets, relative to the app,
 * which replaces the default loader files; null when only runtime values,
 * such as an environment variable or spread options, could tell.
 */
export function getVitePluginLoaderPath(
  viteConfig: SourceFile,
  appDirectory: string
): string | null | undefined {
  const options = findVitePluginCalls(viteConfig, TANSTACK_PLUGIN).map((call) =>
    getStaticPluginOption(call, 'loadTranslationsPath')
  );
  const loaderPath = options.find(
    (option): option is string => typeof option === 'string'
  );
  if (loaderPath === undefined) {
    return options.includes(null) ? null : undefined;
  }
  return path
    .relative(appDirectory, path.resolve(appDirectory, loaderPath))
    .split(path.sep)
    .join(path.posix.sep);
}

/** The config path as the plugin option names it, relative to the app. */
function getVitePluginConfig({
  appDirectory,
  configFilepath,
}: BuildToolContext): string {
  return path
    .relative(appDirectory, path.resolve(appDirectory, configFilepath))
    .split(path.sep)
    .join(path.posix.sep);
}

/** `value` in `quote`, escaped so the literal reads back unchanged. */
function toStringLiteral(value: string, quote: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replaceAll(quote, `\\${quote}`)
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  return `${quote}${escaped}${quote}`;
}

/** The plugin call, naming the config only when it is not the default. */
function getVitePluginCall(
  name: string,
  ctx: BuildToolContext,
  quote: string
): string {
  const config = getVitePluginConfig(ctx);
  return config === VITE_PLUGIN_DEFAULT_CONFIG
    ? `${name}()`
    : `${name}({ config: ${toStringLiteral(config, quote)} })`;
}

/**
 * Asks to point a registered plugin at a moved config. Editing its options
 * could drop the person's own, so the file is left to them.
 */
export function getVitePluginConfigAction(
  viteConfig: SourceFile,
  ctx: BuildToolContext
): ManualAction | undefined {
  const { appDirectory, configFilepath } = ctx;
  const expected = path.resolve(appDirectory, configFilepath);
  const current = findVitePluginCalls(viteConfig, TANSTACK_PLUGIN)
    .map(getStaticPluginConfig)
    .find(
      (config) =>
        config !== undefined && path.resolve(appDirectory, config) !== expected
    );
  if (current === undefined) return undefined;
  const local = getLocalImport(viteConfig, VITE_PLUGIN, VITE_PLUGIN_SOURCE)!;
  return {
    whatHappened: `${viteConfig.path} was left unchanged, but its ${local}() call reads ${current} instead of ${getVitePluginConfig(ctx)}`,
    // Replacing the whole call would drop options such as
    // experimentalCompilerOptions.
    fix: `Set the config option of the ${local}() call in ${viteConfig.path} to ${toStringLiteral(getVitePluginConfig(ctx), "'")}, keeping its other options (see ${DOCS_URL})`,
  };
}

/** The config with the plugin appended, or undefined when unsupported. */
export function configureViteConfig(
  viteConfig: SourceFile,
  ctx: BuildToolContext
): string | undefined {
  return addVitePluginCall(viteConfig, TANSTACK_PLUGIN, (local, quote) =>
    getVitePluginCall(local, ctx, quote)
  );
}

export function getViteConfigAction(
  viteConfig: SourceFile,
  ctx: BuildToolContext
): ManualAction {
  return {
    whatHappened: `${viteConfig.path} was not configured automatically`,
    fix: `Add import { ${VITE_PLUGIN} } from '${VITE_PLUGIN_SOURCE}' to ${viteConfig.path}, and add ${getVitePluginCall(VITE_PLUGIN, ctx, "'")} to the plugins of defineConfig (see ${DOCS_URL})`,
  };
}
