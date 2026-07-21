import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports } from '../importUtils.js';
import type { MigrationContext, SourceResult, TodoEntry } from '../types.js';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;
const generate: typeof generateModule =
  (generateModule as { default?: typeof generateModule }).default ||
  generateModule;

const FORMATJS_SWC_PLUGIN = '@formatjs/swc-plugin';

/**
 * Wraps a react-intl app's next.config in `withGTConfig` (gt-next requires it)
 * and tears down the FormatJS build plugin. gt-next needs no build plugin for
 * dictionary-compat, so `@formatjs/swc-plugin` is removed on a full migration;
 * while skipped files remain it is kept (retained react-intl call sites may rely
 * on it for id injection) and a TODO explains the follow-up.
 */
export function transformReactIntlNextConfig(
  file: string,
  code: string,
  ctx: MigrationContext
): SourceResult {
  const none: SourceResult = {
    code: null,
    todos: [],
    skipReasons: [],
  };
  const retainFormatjs = ctx.skippedFiles.size > 0;

  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      tokens: true,
      createParenthesizedExpressions: true,
    });
  } catch (error) {
    return {
      ...none,
      skipReasons: [`file could not be parsed: ${String(error)}`],
    };
  }

  const todos: TodoEntry[] = [];
  let mutated = false;

  // 1. Remove the @formatjs/swc-plugin entry from any experimental.swcPlugins
  //    array (unless partial, where retained react-intl code may need it).
  if (!retainFormatjs) {
    traverse(ast, {
      ArrayExpression(pathArray) {
        const before = pathArray.node.elements.length;
        pathArray.node.elements = pathArray.node.elements.filter(
          (element) => !isFormatjsPluginEntry(element)
        );
        if (pathArray.node.elements.length !== before) mutated = true;
      },
    });
    // Drop a now-empty `swcPlugins: []` property.
    traverse(ast, {
      ObjectProperty(pathProp) {
        if (
          !pathProp.node.computed &&
          t.isIdentifier(pathProp.node.key, { name: 'swcPlugins' }) &&
          t.isArrayExpression(pathProp.node.value) &&
          pathProp.node.value.elements.length === 0
        ) {
          pathProp.remove();
          mutated = true;
        }
      },
    });
  } else if (code.includes(FORMATJS_SWC_PLUGIN)) {
    todos.push({
      file,
      reason:
        'FormatJS build plugin kept because some files still use react-intl — re-run `gt migrate` once they are converted to remove it',
    });
  }

  // 2. Wrap the default-exported config in withGTConfig(config, { dictionary }).
  const dictionaryPath = relativeDictionaryPath(ctx);
  let wrapped = false;
  traverse(ast, {
    ExportDefaultDeclaration(pathExport) {
      const declaration = pathExport.node.declaration;
      if (!t.isExpression(declaration)) return;
      if (isAlreadyGtWrapped(declaration)) {
        wrapped = true;
        return;
      }
      pathExport.node.declaration = gtConfigCall(declaration, dictionaryPath);
      wrapped = true;
      mutated = true;
    },
    AssignmentExpression(pathAssign) {
      // CJS: module.exports = <config>
      const { left, right } = pathAssign.node;
      if (
        !t.isMemberExpression(left) ||
        !t.isIdentifier(left.object, { name: 'module' }) ||
        !t.isIdentifier(left.property, { name: 'exports' })
      ) {
        return;
      }
      if (isAlreadyGtWrapped(right)) {
        wrapped = true;
        return;
      }
      pathAssign.node.right = gtConfigCall(right, dictionaryPath);
      wrapped = true;
      mutated = true;
    },
  });

  if (!wrapped) {
    return {
      ...none,
      skipReasons: [
        'next.config has no recognizable default export to wrap in withGTConfig (manual conversion)',
      ],
    };
  }

  if (!mutated) return { ...none, todos };

  ensureNamedImports(ast, 'gt-next/config', ['withGTConfig']);

  const output = generate(
    ast,
    {
      retainLines: true,
      retainFunctionParens: true,
      comments: true,
      compact: 'auto',
    },
    code
  );
  return { code: output.code, todos, skipReasons: [] };
}

function isFormatjsPluginEntry(element: t.Node | null): boolean {
  if (!element) return false;
  // `['@formatjs/swc-plugin', {...}]`
  if (t.isArrayExpression(element)) {
    const first = element.elements[0];
    return t.isStringLiteral(first, { value: FORMATJS_SWC_PLUGIN });
  }
  // `'@formatjs/swc-plugin'`
  return t.isStringLiteral(element, { value: FORMATJS_SWC_PLUGIN });
}

function isAlreadyGtWrapped(node: t.Expression): boolean {
  return (
    t.isCallExpression(node) &&
    t.isIdentifier(node.callee, { name: 'withGTConfig' })
  );
}

function gtConfigCall(
  config: t.Expression,
  dictionaryPath: string
): t.CallExpression {
  return t.callExpression(t.identifier('withGTConfig'), [
    config,
    t.objectExpression([
      t.objectProperty(
        t.identifier('dictionary'),
        t.stringLiteral(dictionaryPath)
      ),
    ]),
  ]);
}

function relativeDictionaryPath(ctx: MigrationContext): string {
  const absolute = path.join(
    ctx.catalogs.dir,
    `${ctx.catalogs.defaultLocale}.json`
  );
  const relative = path.relative(ctx.cwd, absolute).split(path.sep).join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}
