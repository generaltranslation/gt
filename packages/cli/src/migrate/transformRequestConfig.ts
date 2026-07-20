import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports } from './importUtils.js';
import type { SourceResult } from './types.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

/**
 * Partial migrations keep next-intl's request config alive for the skipped
 * files, but gt-next's middleware no longer populates `requestLocale` — so
 * the config's fallback branch runs on every request and every skipped file
 * renders default-locale messages. Shadow-wrap the `requestLocale` promise
 * so its empty case resolves through gt-next's getLocale() instead. This is
 * shape-agnostic: whatever the body does with `await requestLocale`
 * downstream now sees the resolved page locale.
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
  traverse(ast, {
    CallExpression(path) {
      if (rewired) return;
      if (!t.isIdentifier(path.node.callee, { name: 'getRequestConfig' })) {
        return;
      }
      const fn = path.node.arguments[0];
      if (!t.isArrowFunctionExpression(fn) && !t.isFunctionExpression(fn)) {
        return;
      }
      const param = fn.params[0];
      if (!t.isObjectPattern(param)) return;
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
      requestLocaleProp.value = t.identifier('_gtRequestLocale');
      requestLocaleProp.shorthand = false;

      // const requestLocale = _gtRequestLocale.then(
      //   async (requested) => requested ?? (await getLocale())
      // );
      const wrapper = t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier('requestLocale'),
          t.callExpression(
            t.memberExpression(
              t.identifier('_gtRequestLocale'),
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

  if (!rewired) {
    return {
      ...none,
      todos: [
        {
          file,
          reason:
            'request config shape not recognized — with gt-next owning the middleware, its requestLocale fallback runs on every request; wire the fallback to gt-next/server getLocale() so skipped files render the page locale',
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
