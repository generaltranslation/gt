// vite.config.*: adding the GT compiler plugin after the app's own plugins.
import { parse, type ParseResult } from '@babel/parser';
import * as t from '@babel/types';
import fs from 'node:fs';
import path from 'node:path';
import {
  checkCompilerImport,
  type CheckCompilerImportResult,
} from '../../../react/parse/addVitePlugin/utils/checkCompilerImport.js';
import { checkPluginInvocation } from '../../../react/parse/addVitePlugin/utils/checkPluginInvocation.js';
import { toRelativeImport } from '../../setupViteSPA.js';
import type { SetupResult } from '../index.js';
import { applyEdits, getCodeStyle, getImportEdit, type Edit } from './edits.js';
import { getPropertyName, readSourceFile, usesName } from './source.js';

export const COMPILER_PACKAGE = '@generaltranslation/compiler';
const COMPILER_ALIAS = 'gtCompiler';
const VITE_CONFIG_EXTENSIONS = ['.ts', '.mts', '.js', '.mjs'];
const DEFAULT_CONFIG_FILE = 'gt.config.json';

/** The fix a person applies when setup cannot edit the Vite config. */
export const COMPILER_PLUGIN_FIX = `Add import { vite as ${COMPILER_ALIAS} } from '${COMPILER_PACKAGE}' to your Vite config and ${COMPILER_ALIAS}() to the end of its plugins array, after tanstackStart() and react()`;

function parseConfig(content: string): ParseResult<t.File> | undefined {
  try {
    return parse(content, { sourceType: 'module', plugins: ['typescript'] });
  } catch {
    return undefined;
  }
}

/** The `plugins` array of `defineConfig({...})` or `export default {...}`. */
function findPluginsArray(ast: t.File): t.ArrayExpression | undefined {
  const configObjects: t.ObjectExpression[] = [];
  t.traverseFast(ast, (node) => {
    if (
      node.type === 'CallExpression' &&
      t.isIdentifier(node.callee, { name: 'defineConfig' }) &&
      node.arguments[0]?.type === 'ObjectExpression'
    ) {
      configObjects.push(node.arguments[0]);
    }
    if (
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration.type === 'ObjectExpression'
    ) {
      configObjects.push(node.declaration);
    }
  });
  if (configObjects.length !== 1) return undefined;
  const plugins = configObjects[0].properties.filter(
    (property) => getPropertyName(property) === 'plugins'
  );
  if (plugins.length !== 1 || plugins[0].type !== 'ObjectProperty') {
    return undefined;
  }
  return plugins[0].value.type === 'ArrayExpression'
    ? plugins[0].value
    : undefined;
}

/** Whether a plugins array element calls the imported compiler plugin. */
function callsCompiler(
  element: t.ArrayExpression['elements'][number],
  { alias, namespaces }: CheckCompilerImportResult
): boolean {
  if (element?.type !== 'CallExpression') return false;
  const { callee } = element;
  return (
    (alias !== null && t.isIdentifier(callee, { name: alias })) ||
    (callee.type === 'MemberExpression' &&
      callee.object.type === 'Identifier' &&
      namespaces.includes(callee.object.name) &&
      t.isIdentifier(callee.property, { name: 'vite' }))
  );
}

function callsTanStackStart(
  element: t.ArrayExpression['elements'][number]
): boolean {
  return (
    element?.type === 'CallExpression' &&
    t.isIdentifier(element.callee, { name: 'tanstackStart' })
  );
}

/** Appends the plugin call to the array, matching its line layout. */
function getPluginEdit(
  content: string,
  plugins: t.ArrayExpression,
  call: string
): Edit {
  const last = plugins.elements.filter((element) => element !== null).at(-1);
  if (!last)
    return { start: plugins.start! + 1, end: plugins.end! - 1, text: call };
  const trailingComma = /^\s*,/.exec(
    content.slice(last.end!, plugins.end! - 1)
  );
  const multiline = plugins.loc!.start.line !== last.loc!.end.line;
  if (!multiline) {
    return { start: last.end!, text: `, ${call}` };
  }
  const lineStart = content.lastIndexOf('\n', last.start! - 1) + 1;
  const indent = /^[ \t]*/.exec(content.slice(lineStart))![0];
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  return trailingComma
    ? {
        start: last.end! + trailingComma[0].length,
        text: `${eol}${indent}${call},`,
      }
    : { start: last.end!, text: `,${eol}${indent}${call}` };
}

/**
 * Adds `gtCompiler()` from @generaltranslation/compiler to the end of the
 * Vite config's plugins, so it runs after tanstackStart() splits routes and
 * after react() compiles JSX. Shapes it cannot edit become a manual action.
 */
export async function addCompilerPlugin(
  appDirectory: string,
  configFilepath = DEFAULT_CONFIG_FILE
): Promise<SetupResult> {
  const config = await readSourceFile(appDirectory, 'vite.config', {
    extensions: VITE_CONFIG_EXTENSIONS,
  });
  const ast = config && parseConfig(config.content);
  const plugins = ast && findPluginsArray(ast);
  if (!config || !ast || !plugins) {
    return {
      steps: [],
      manualActions: [
        {
          whatHappened: config
            ? `${config.path} was not configured automatically`
            : 'No vite.config file was found',
          fix: COMPILER_PLUGIN_FIX,
        },
      ],
    };
  }
  const compilerImport = checkCompilerImport(ast);
  if (checkPluginInvocation({ ast, ...compilerImport })) {
    // Route splitting must run first, or split route modules miss the compiler.
    const compilerIndex = plugins.elements.findIndex((element) =>
      callsCompiler(element, compilerImport)
    );
    const tanstackIndex = plugins.elements.findIndex(callsTanStackStart);
    if (compilerIndex !== -1 && compilerIndex < tanstackIndex) {
      return {
        steps: [],
        manualActions: [
          {
            whatHappened: `${config.path} runs the GT compiler before tanstackStart()`,
            fix: `Move the GT compiler plugin after tanstackStart() in ${config.path}`,
          },
        ],
      };
    }
    return { steps: [], manualActions: [] };
  }
  const edits: Edit[] = [];
  let call: string;
  if (compilerImport.hasCompilerImport) {
    call = compilerImport.alias
      ? `${compilerImport.alias}()`
      : `${compilerImport.namespaces[0]}.vite()`;
  } else {
    // A binding of the same name belongs to the app.
    if (usesName(ast.program.body, [COMPILER_ALIAS])) {
      return {
        steps: [],
        manualActions: [
          {
            whatHappened: `${config.path} already uses the name ${COMPILER_ALIAS}`,
            fix: COMPILER_PLUGIN_FIX,
          },
        ],
      };
    }
    const { quote, semi, eol } = getCodeStyle(config.content, ast.program.body);
    edits.push(
      getImportEdit(
        ast.program.body,
        [
          `import { vite as ${COMPILER_ALIAS} } from ${quote}${COMPILER_PACKAGE}${quote}${semi}`,
        ],
        eol
      )
    );
    call = `${COMPILER_ALIAS}()`;
  }
  edits.push(getPluginEdit(config.content, plugins, call));
  await fs.promises.writeFile(
    path.join(appDirectory, config.path),
    applyEdits(config.content, edits)
  );
  // The plugin reads gt.config.json from the app root by default.
  const defaultConfig = path.join(appDirectory, DEFAULT_CONFIG_FILE);
  const configPath = path.resolve(appDirectory, configFilepath);
  return {
    steps: [`added ${call} to ${config.path}`],
    manualActions:
      configPath === defaultConfig
        ? []
        : [
            {
              whatHappened: `The GT compiler reads ${DEFAULT_CONFIG_FILE} from the app root, but this app uses ${configFilepath}`,
              fix: `In ${config.path}, import gtConfig from '${toRelativeImport(appDirectory, configPath)}' and pass it as ${call.slice(0, -1)}{ gtConfig })`,
            },
          ],
  };
}
