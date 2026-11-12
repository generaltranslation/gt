// vite.config.*: finding and adding a GT plugin in defineConfig's plugins.
import * as t from '@babel/types';
import fs from 'node:fs';
import path from 'node:path';
import { Libraries } from '../../../types/libraries.js';
import { parseModule } from '../../setupViteSPA.js';
import type { SetupResult } from '../index.js';
import {
  applyEdits,
  getCodeStyle,
  getImportEdit,
  getLineIndent,
} from './edits.js';
import {
  getBindingAt,
  getLocalImport,
  getPropertyName,
  readSourceFile,
  usesName,
  type SourceFile,
} from './source.js';

/** A plugin factory, imported by name from a module. */
export type VitePlugin = { name: string; source: string };

// Vite's own lookup order for a config file.
const VITE_CONFIG_EXTENSIONS = ['.js', '.mjs', '.ts', '.cjs', '.mts', '.cts'];

export function readViteConfig(appDirectory: string) {
  return readSourceFile(appDirectory, 'vite.config', {
    extensions: VITE_CONFIG_EXTENSIONS,
  });
}

/**
 * Whether the package the app resolves exports `subpath`; undefined when it
 * is not installed. Checked by capability rather than version, so
 * prereleases count.
 */
export async function hasPackageExport(
  appDirectory: string,
  packageName: string,
  subpath: string
): Promise<boolean | undefined> {
  for (let dir = path.resolve(appDirectory); ; dir = path.dirname(dir)) {
    const manifest = path.join(
      dir,
      'node_modules',
      packageName,
      'package.json'
    );
    if (fs.existsSync(manifest)) {
      const { exports } = JSON.parse(
        await fs.promises.readFile(manifest, 'utf8')
      ) as { exports?: Record<string, unknown> };
      return exports?.[subpath] !== undefined;
    }
    if (path.dirname(dir) === dir) return undefined;
  }
}

/**
 * Plugin calls among array elements, spread or not, including nested arrays,
 * which Vite flattens.
 */
export function collectPluginCalls(
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
export function findVitePluginCalls(
  viteConfig: SourceFile,
  { name, source }: VitePlugin
): t.CallExpression[] {
  const local = getLocalImport(viteConfig, name, source);
  const plugins =
    viteConfig.statements && findPluginsArray(viteConfig.statements);
  if (local === undefined || plugins === undefined) return [];
  return collectPluginCalls(plugins.elements, local);
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
export function findPluginsArray(
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

/**
 * The config with the plugin call appended, and imported unless it already
 * is, or undefined when unsupported. `getCall` writes the call for the local
 * name in the config's quote style.
 */
export function addVitePluginCall(
  viteConfig: SourceFile,
  { name, source }: VitePlugin,
  getCall: (local: string, quote: string) => string
): string | undefined {
  const { content, statements } = viteConfig;
  if (!statements) return undefined;
  const local = getLocalImport(viteConfig, name, source);
  // Another binding with this name would clash with the added import.
  if (!local && usesName(statements, [name])) {
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
  const call = getCall(local ?? name, quote);
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
            [`import { ${name} } from ${quote}${source}${quote}${semi}`],
            eol
          ),
        ]),
  ]);
  return parseModule(configured, viteConfig.path) ? configured : undefined;
}

const GT_REACT_SUBPATH = './vite';
const GT_REACT_PLUGIN: VitePlugin = {
  name: 'gtReact',
  source: `${Libraries.GT_REACT}/vite`,
};
const GT_REACT_PLUGIN_STEP = `add import { ${GT_REACT_PLUGIN.name} } from '${GT_REACT_PLUGIN.source}' and add ${GT_REACT_PLUGIN.name}() to the plugins of defineConfig`;

/**
 * Registers gtReact() in the Vite config, which passes GT_PROJECT_ID to the
 * app and GT_API_KEY during `vite serve` only. A config that already
 * registers it is left as it is. `keepAppSource` reports the change instead
 * of writing it.
 */
export async function configureGTReactPlugin(
  appDirectory: string,
  keepAppSource: boolean
): Promise<SetupResult> {
  const viteConfig = await readViteConfig(appDirectory);
  if (!viteConfig) {
    return {
      steps: [],
      manualActions: [
        {
          whatHappened: 'No vite.config was found',
          fix: `Create vite.config.ts, then ${GT_REACT_PLUGIN_STEP}`,
        },
      ],
    };
  }
  if (findVitePluginCalls(viteConfig, GT_REACT_PLUGIN).length > 0) {
    return { steps: [], manualActions: [] };
  }
  // Installing gt-react keeps an existing version, which may predate the
  // plugin, and a declared one may not be installed yet; importing a missing
  // export would break the build.
  if (
    !(await hasPackageExport(
      appDirectory,
      Libraries.GT_REACT,
      GT_REACT_SUBPATH
    ))
  ) {
    return {
      steps: [],
      manualActions: [
        {
          whatHappened: `No installed ${Libraries.GT_REACT} with a Vite plugin was found, so GT left ${viteConfig.path} unchanged`,
          fix: `Install or upgrade ${Libraries.GT_REACT} to 12 or later, then in ${viteConfig.path}, ${GT_REACT_PLUGIN_STEP}`,
        },
      ],
    };
  }
  const configured = keepAppSource
    ? undefined
    : addVitePluginCall(viteConfig, GT_REACT_PLUGIN, (local) => `${local}()`);
  if (!configured) {
    return {
      steps: [],
      manualActions: [
        {
          whatHappened: `${viteConfig.path} was not configured automatically`,
          fix: `In ${viteConfig.path}, ${GT_REACT_PLUGIN_STEP}`,
        },
      ],
    };
  }
  await fs.promises.writeFile(
    path.join(appDirectory, viteConfig.path),
    configured
  );
  return { steps: [`configured ${viteConfig.path}`], manualActions: [] };
}
