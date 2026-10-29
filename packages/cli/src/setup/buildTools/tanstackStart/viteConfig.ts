// vite.config.*: the gtTanstackStart plugin in defineConfig's plugins.
import * as t from '@babel/types';
import path from 'node:path';
import { parseModule } from '../../setupViteSPA.js';
import {
  usesLocaleTwins,
  type BuildToolContext,
  type ManualAction,
} from '../index.js';
import {
  applyEdits,
  getCodeStyle,
  getImportEdit,
  getLineIndent,
} from '../shared/edits.js';
import {
  getBindingAt,
  getLocalImport,
  getPropertyName,
  usesName,
  type SourceFile,
} from '../shared/source.js';
import { DOCS_URL, VITE_PLUGIN_SOURCE } from './source.js';

const VITE_PLUGIN = 'gtTanstackStart';
const START_PLUGIN = 'tanstackStart';
const START_PLUGIN_SOURCE = '@tanstack/react-start/plugin/vite';
// The plugin reads this config path, relative to the working directory, by default.
const VITE_PLUGIN_DEFAULT_CONFIG = 'gt.config.json';

function getVitePluginImport(viteConfig: SourceFile): string | undefined {
  return getLocalImport(viteConfig, VITE_PLUGIN, VITE_PLUGIN_SOURCE);
}

/**
 * Plugin calls among array elements, spread or not, including nested arrays,
 * which Vite flattens.
 */
function collectPluginCalls(
  elements: t.ArrayExpression['elements'],
  local: string
): t.CallExpression[] {
  return elements.flatMap((element) => {
    const plugin =
      element?.type === 'SpreadElement' ? element.argument : element;
    if (plugin?.type === 'ArrayExpression') {
      return collectPluginCalls(plugin.elements, local);
    }
    return plugin?.type === 'CallExpression' &&
      t.isIdentifier(plugin.callee, { name: local })
      ? [plugin]
      : [];
  });
}

/**
 * The plugins elements of the exported config that are themselves the plugin
 * call; a call anywhere else, or behind a condition, may register nothing
 * with Vite.
 */
function findVitePluginCalls(viteConfig: SourceFile): t.CallExpression[] {
  const local = getVitePluginImport(viteConfig);
  const plugins =
    viteConfig.statements && findPluginsArray(viteConfig.statements);
  if (local === undefined || plugins === undefined) return [];
  return collectPluginCalls(plugins.elements, local);
}

export function registersVitePlugin(viteConfig: SourceFile): boolean {
  return findVitePluginCalls(viteConfig).length > 0;
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
  const options = findVitePluginCalls(viteConfig).map((call) =>
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

/** Locale twins need the compiler to attribute strings to chunks. */
const COMPILER_OPTION = 'experimentalCompilerOptions';
const getCompilerOption = (quote: string) =>
  `${COMPILER_OPTION}: { type: ${quote}babel${quote} }`;

/**
 * The plugin call, naming the config only when it is not the default, and
 * enabling the compiler for locale twins.
 */
function getVitePluginCall(
  name: string,
  ctx: BuildToolContext,
  quote: string
): string {
  const config = getVitePluginConfig(ctx);
  const options = [
    ...(config === VITE_PLUGIN_DEFAULT_CONFIG
      ? []
      : [`config: ${toStringLiteral(config, quote)}`]),
    ...(usesLocaleTwins(ctx) ? [getCompilerOption(quote)] : []),
  ];
  return options.length ? `${name}({ ${options.join(', ')} })` : `${name}()`;
}

/**
 * Whether a plugin call enables the compiler: false when it is off, or null
 * when only runtime values, such as a spread or a variable, could tell.
 */
function enablesCompiler(call: t.CallExpression): boolean | null {
  if (call.arguments.length === 0) return false;
  const [options] = call.arguments;
  if (call.arguments.length !== 1 || options.type !== 'ObjectExpression') {
    return null;
  }
  const compiler = findPropertyValue(options, COMPILER_OPTION);
  if (compiler === undefined) return false;
  if (compiler?.type !== 'ObjectExpression') return null;
  const type = findPropertyValue(compiler, 'type');
  if (type === undefined) return false;
  if (type?.type !== 'StringLiteral') return null;
  return type.value === 'babel';
}

/**
 * Asks to enable the compiler in a registered plugin for locale twins.
 * Editing its options could drop the person's own, so the file is left to
 * them.
 */
export function getVitePluginCompilerAction(
  viteConfig: SourceFile,
  ctx: BuildToolContext
): ManualAction | undefined {
  if (!usesLocaleTwins(ctx)) return undefined;
  const calls = findVitePluginCalls(viteConfig);
  if (
    calls.length === 0 ||
    !calls.every((call) => enablesCompiler(call) === false)
  ) {
    return undefined;
  }
  const local = getVitePluginImport(viteConfig)!;
  return {
    whatHappened: `${viteConfig.path} was left unchanged, but its ${local}() call does not run the GT compiler, which locale twins need`,
    fix: `Add ${getCompilerOption("'")} to the options of the ${local}() call in ${viteConfig.path}, keeping its other options (see ${DOCS_URL})`,
  };
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
  const current = findVitePluginCalls(viteConfig)
    .map(getStaticPluginConfig)
    .find(
      (config) =>
        config !== undefined && path.resolve(appDirectory, config) !== expected
    );
  if (current === undefined) return undefined;
  const local = getVitePluginImport(viteConfig)!;
  return {
    whatHappened: `${viteConfig.path} was left unchanged, but its ${local}() call reads ${current} instead of ${getVitePluginConfig(ctx)}`,
    // Replacing the whole call would drop options such as
    // experimentalCompilerOptions.
    fix: `Set the config option of the ${local}() call in ${viteConfig.path} to ${toStringLiteral(getVitePluginConfig(ctx), "'")}, keeping its other options (see ${DOCS_URL})`,
  };
}

/**
 * The default export, followed through a top-level const as in the create
 * template's `const config = defineConfig({ ... })` / `export default config`.
 */
function getExportedConfig(statements: t.Statement[]): t.Node | undefined {
  const exported = statements.find(
    (statement) => statement.type === 'ExportDefaultDeclaration'
  )?.declaration;
  if (exported?.type !== 'Identifier') return exported;
  const binding = getBindingAt(statements, exported, exported.name);
  // Any other use, such as `config.plugins = [...]`, could change what Vite
  // reads after the declaration.
  if (
    binding?.kind !== 'const' ||
    binding.referencePaths.length !== 1 ||
    binding.constantViolations.length > 0 ||
    binding.path.node.type !== 'VariableDeclarator'
  ) {
    return undefined;
  }
  return binding.path.node.init ?? undefined;
}

/**
 * The plugins array of the exported `defineConfig({ ... })`. Spreads or
 * computed keys could override it, so they are left for manual setup.
 */
function findPluginsArray(
  statements: t.Statement[]
): t.ArrayExpression | undefined {
  const call = getExportedConfig(statements);
  if (
    call?.type !== 'CallExpression' ||
    !t.isIdentifier(call.callee, { name: 'defineConfig' })
  ) {
    return undefined;
  }
  const options = call.arguments[0];
  if (options?.type !== 'ObjectExpression') return undefined;
  const names = options.properties.map(getPropertyName);
  if (
    names.includes(undefined) ||
    names.filter((name) => name === 'plugins').length !== 1
  ) {
    return undefined;
  }
  const plugins = options.properties[names.indexOf('plugins')];
  return plugins.type === 'ObjectProperty' &&
    plugins.value.type === 'ArrayExpression'
    ? plugins.value
    : undefined;
}

/** The config with the plugin appended, or undefined when unsupported. */
export function configureViteConfig(
  viteConfig: SourceFile,
  ctx: BuildToolContext
): string | undefined {
  const { content, statements } = viteConfig;
  if (!statements) return undefined;
  const local = getVitePluginImport(viteConfig);
  // Another binding with this name would clash with the added import.
  if (!local && usesName(statements, [VITE_PLUGIN])) {
    return undefined;
  }
  const plugins = findPluginsArray(statements);
  const last = plugins?.elements.at(-1);
  // A trailing hole such as `[a, ,]` has no element to follow, and Babel ends
  // a parenthesized element before its `)`, where a comma would fold the new
  // call into the element as a comma expression.
  if (!plugins || last === null || last?.extra?.parenthesized) {
    return undefined;
  }
  // Any use of the import, such as a call behind a condition or an alias,
  // may already register the plugin, so another call could register it twice.
  if (
    local &&
    usesName(
      statements.filter((statement) => statement.type !== 'ImportDeclaration'),
      [local]
    )
  ) {
    return undefined;
  }
  // The new call would take over a comment that ends the last element's line,
  // such as an eslint-disable-line.
  if (
    last &&
    /\/[/*]/.test(content.slice(last.end!, plugins.end! - 1).split('\n')[0])
  ) {
    return undefined;
  }
  const { quote, semi, eol } = getCodeStyle(content, statements);
  const call = getVitePluginCall(local ?? VITE_PLUGIN, ctx, quote);
  const pluginEdit = !last
    ? { start: plugins.start! + 1, text: call }
    : {
        start: last.end!,
        // A multiline array keeps one plugin per line.
        text:
          last.loc!.start.line === plugins.loc!.start.line
            ? `, ${call}`
            : `,${eol}${getLineIndent(content, last.start!)}${call}`,
      };
  const configured = applyEdits(content, [
    pluginEdit,
    ...(local
      ? []
      : [
          getImportEdit(
            statements,
            [
              `import { ${VITE_PLUGIN} } from ${quote}${VITE_PLUGIN_SOURCE}${quote}${semi}`,
            ],
            eol
          ),
        ]),
  ]);
  return parseModule(configured, viteConfig.path) ? configured : undefined;
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
