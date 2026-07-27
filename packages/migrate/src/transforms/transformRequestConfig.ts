import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports } from './importUtils.js';
import type { SourceResult } from '../pipeline/types.js';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;
const generate: typeof generateModule =
  (generateModule as { default?: typeof generateModule }).default ||
  generateModule;

/** The shadow name this transform renames the destructured promise to. */
const SHADOW_PARAM = '_gtRequestLocale';

/** Local names `getLocale` is value-bound to from gt-next/server, if any. */
function getLocaleLocals(ast: t.File): Set<string> {
  const locals = new Set<string>();
  for (const statement of ast.program.body) {
    if (!t.isImportDeclaration(statement)) continue;
    if (statement.source.value !== 'gt-next/server') continue;
    if (statement.importKind === 'type') continue;
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier)) continue;
      if (specifier.importKind === 'type') continue;
      if (t.isIdentifier(specifier.imported, { name: 'getLocale' })) {
        locals.add(specifier.local.name);
      }
    }
  }
  return locals;
}

/** True when `node` calls one of `locals` anywhere inside it. */
function callsAny(node: t.Node, locals: Set<string>): boolean {
  let found = false;
  t.traverseFast(node, (child) => {
    if (found) return;
    if (t.isCallExpression(child) && t.isIdentifier(child.callee)) {
      if (locals.has(child.callee.name)) found = true;
    }
  });
  return found;
}

/**
 * True when this callback already carries this transform's own output: a
 * shadowed `requestLocale`, the `.then(...)` wrapper over it, and a getLocale()
 * call inside. Keyed on the AST, so reformatting cannot hide it from a re-run.
 */
function isAlreadyWired(
  param: t.ObjectPattern,
  body: t.BlockStatement | t.Expression,
  ast: t.File
): boolean {
  if (!t.isBlockStatement(body)) return false;
  const renamed = param.properties.find(
    (property) =>
      t.isObjectProperty(property) &&
      !property.computed &&
      t.isIdentifier(property.key, { name: 'requestLocale' }) &&
      t.isIdentifier(property.value) &&
      property.value.name !== 'requestLocale'
  ) as t.ObjectProperty | undefined;
  if (!renamed) return false;
  const shadow = (renamed.value as t.Identifier).name;

  const locals = getLocaleLocals(ast);
  if (locals.size === 0) return false;

  return body.body.some(
    (statement) =>
      t.isVariableDeclaration(statement) &&
      statement.declarations.some(
        (declarator) =>
          t.isIdentifier(declarator.id, { name: 'requestLocale' }) &&
          t.isCallExpression(declarator.init) &&
          t.isMemberExpression(declarator.init.callee) &&
          !declarator.init.callee.computed &&
          t.isIdentifier(declarator.init.callee.object, { name: shadow }) &&
          t.isIdentifier(declarator.init.callee.property, { name: 'then' }) &&
          declarator.init.arguments.some((argument) =>
            callsAny(argument, locals)
          )
      )
  );
}

/**
 * Partial migrations keep next-intl's request config alive for the skipped
 * files, but gt-next's middleware no longer populates `requestLocale`; so
 * the config's fallback branch runs on every request and every skipped file
 * renders default-locale messages. Shadow-wrap the `requestLocale` promise
 * so its empty case resolves through gt-next's getLocale() instead. This is
 * shape-agnostic: whatever the body does with `await requestLocale`
 * downstream now sees the resolved page locale.
 *
 * Idempotent: a re-run over a file this already wired returns no work and no
 * TODO. Without the guard the wired shape read as "shape not recognized", so
 * every re-run told the user to wire a fallback the first run had wired.
 */
export function transformRequestConfigFile(
  file: string,
  code: string
): SourceResult {
  const none: SourceResult = {
    code: null,
    todos: [],
    skipReasons: [],
  };
  if (!code.includes('getRequestConfig')) return none;

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

  let rewired = false;
  let alreadyWired = false;
  traverse(ast, {
    CallExpression(path) {
      if (rewired || alreadyWired) return;
      if (!t.isIdentifier(path.node.callee, { name: 'getRequestConfig' })) {
        return;
      }
      const fn = path.node.arguments[0];
      if (!t.isArrowFunctionExpression(fn) && !t.isFunctionExpression(fn)) {
        return;
      }
      const param = fn.params[0];
      if (!t.isObjectPattern(param)) return;
      if (isAlreadyWired(param, fn.body, ast)) {
        alreadyWired = true;
        return;
      }
      const requestLocaleProp = param.properties.find(
        (property) =>
          t.isObjectProperty(property) &&
          !property.computed &&
          t.isIdentifier(property.key, { name: 'requestLocale' }) &&
          t.isIdentifier(property.value, { name: 'requestLocale' })
      ) as t.ObjectProperty | undefined;
      if (!requestLocaleProp) return;
      if (!t.isBlockStatement(fn.body)) return;

      // { requestLocale } -> { requestLocale: _gtRequestLocale }
      requestLocaleProp.value = t.identifier(SHADOW_PARAM);
      requestLocaleProp.shorthand = false;

      // const requestLocale = _gtRequestLocale.then(
      //   async (requested) => requested ?? (await getLocale())
      // );
      const wrapper = t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier('requestLocale'),
          t.callExpression(
            t.memberExpression(
              t.identifier(SHADOW_PARAM),
              t.identifier('then')
            ),
            [
              (() => {
                const arrow = t.arrowFunctionExpression(
                  [t.identifier('requested')],
                  t.logicalExpression(
                    '??',
                    t.identifier('requested'),
                    t.awaitExpression(
                      t.callExpression(t.identifier('getLocale'), [])
                    )
                  )
                );
                arrow.async = true;
                return arrow;
              })(),
            ]
          )
        ),
      ]);
      fn.body.body.unshift(wrapper);
      rewired = true;
    },
  });

  if (alreadyWired) return none;

  if (!rewired) {
    return {
      ...none,
      todos: [
        {
          file,
          reason:
            'request config shape not recognized; with gt-next owning the middleware, its requestLocale fallback runs on every request; wire the fallback to gt-next/server getLocale() so skipped files render the page locale',
        },
      ],
    };
  }

  ensureNamedImports(ast, 'gt-next/server', ['getLocale']);

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
  return {
    code: output.code,
    todos: [],
    skipReasons: [],
  };
}
