// vite.config.*: the gtTanstackStart plugin in defineConfig's plugins.
import traverseModule, { type Binding } from '@babel/traverse';
import * as t from '@babel/types';
import path from 'node:path';
import { parseModule } from '../../setupViteSPA.js';
import type { BuildToolContext, ManualAction } from '../index.js';
import {
  applyEdits,
  getCodeStyle,
  getImportEdit,
  getLineIndent,
} from '../shared/edits.js';
import {
  getLocalImport,
  getPropertyName,
  usesName,
  type SourceFile,
} from '../shared/source.js';
import { DOCS_URL, VITE_PLUGIN_SOURCE } from './source.js';

const traverse = traverseModule.default || traverseModule;

const VITE_PLUGIN = 'gtTanstackStart';
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
 * The config path a plugin call reads, or undefined when only runtime values
 * such as an environment variable or a spread could tell.
 */
function getStaticPluginConfig(call: t.CallExpression): string | undefined {
  if (call.arguments.length === 0) return VITE_PLUGIN_DEFAULT_CONFIG;
  const [options] = call.arguments;
  if (call.arguments.length !== 1 || options.type !== 'ObjectExpression') {
    return undefined;
  }
  const names = options.properties.map(getPropertyName);
  if (names.includes(undefined)) return undefined;
  // The last duplicate key wins at runtime.
  const index = names.lastIndexOf('config');
  if (index === -1) return VITE_PLUGIN_DEFAULT_CONFIG;
  const config = options.properties[index];
  return config.type === 'ObjectProperty' &&
    config.value.type === 'StringLiteral'
    ? config.value.value
    : undefined;
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
  let binding: Binding | undefined;
  traverse(t.file(t.program(statements)), {
    Program(program) {
      binding = program.scope.getBinding(exported.name);
      program.stop();
    },
  });
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
