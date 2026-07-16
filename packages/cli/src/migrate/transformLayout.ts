import { parse } from '@babel/parser';
import traverseModule, { type NodePath } from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports, removeUnusedNamedImports } from './importUtils.js';
import { transformSourceFile } from './transformSource.js';
import type { MigrationContext, SourceResult, TodoEntry } from './types.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

/**
 * Layout files get the regular source transform plus layout-specific work:
 * locale-validation removal, `lang` -> getLocale(), and GTProvider
 * insertion/nesting. Runs after every other file so the final skip set is
 * known (it decides whether NextIntlClientProvider is retained).
 */
export function transformLayoutFile(
  file: string,
  code: string,
  ctx: MigrationContext
): SourceResult {
  const retainProvider = ctx.skippedFiles.size > 0;
  const base = transformSourceFile(file, code, ctx, {
    retainNextIntlProvider: retainProvider,
    dropLocaleValidation: true,
  });
  if (base.skipReasons.length > 0) return base;

  const working = base.code ?? code;
  let ast: t.File;
  try {
    ast = parse(working, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      tokens: true,
      createParenthesizedExpressions: true,
    });
  } catch (error) {
    return {
      code: null,
      todos: [],
      skipReasons: [`layout could not be parsed: ${String(error)}`],
      usedRich: false,
    };
  }

  const todos: TodoEntry[] = [...base.todos];
  let mutated = false;
  let needsGetLocale = false;
  const isLocaleLayout = file.includes('[locale]');

  // 1. Drop locale-validation guards: `if (!hasLocale(...)) notFound()` and
  //    `if (!locales.includes(locale)) notFound()` shapes.
  traverse(ast, {
    IfStatement(path) {
      const source = generate(path.node.test).code;
      const guardsLocale =
        source.includes('hasLocale(') || source.includes('.includes(');
      if (!guardsLocale) return;
      let callsNotFound = false;
      path.traverse({
        CallExpression(inner) {
          if (t.isIdentifier(inner.node.callee, { name: 'notFound' })) {
            callsNotFound = true;
          }
        },
      });
      if (callsNotFound) {
        todos.push({
          file,
          line: path.node.loc?.start.line,
          reason:
            'locale validation removed — gt-next middleware owns locale resolution; re-add a guard only if this route must 404 on unknown locales',
        });
        path.remove();
        mutated = true;
      }
    },
  });

  // 2. `<html lang={locale}>` -> `<html lang={await getLocale()}>` (only in
  //    [locale] layouts, where the binding came from params).
  if (isLocaleLayout) {
    traverse(ast, {
      JSXAttribute(path) {
        if (!t.isJSXIdentifier(path.node.name, { name: 'lang' })) return;
        const value = path.node.value;
        if (!t.isJSXExpressionContainer(value)) return;
        const expression = value.expression;
        const isLocaleRef =
          t.isIdentifier(expression, { name: 'locale' }) ||
          (t.isMemberExpression(expression) &&
            t.isIdentifier(expression.property, { name: 'locale' }));
        if (!isLocaleRef) return;
        value.expression = t.awaitExpression(
          t.callExpression(t.identifier('getLocale'), [])
        );
        needsGetLocale = true;
        mutated = true;
        const fn = path.getFunctionParent();
        if (fn && !fn.node.async) {
          fn.node.async = true;
        }
      },
    });
  }

  // 3. Ensure a GTProvider wraps the layout children.
  let hasGtProvider = false;
  traverse(ast, {
    JSXIdentifier(path) {
      if (path.node.name === 'GTProvider') hasGtProvider = true;
    },
  });
  if (!hasGtProvider) {
    let inserted = false;
    traverse(ast, {
      JSXElement(path) {
        if (inserted) return;
        const name = path.node.openingElement.name;
        if (!t.isJSXIdentifier(name, { name: 'body' })) return;
        const children = path.node.children;
        const provider = t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('GTProvider'), []),
          t.jsxClosingElement(t.jsxIdentifier('GTProvider')),
          children
        );
        path.node.children = [provider];
        inserted = true;
        mutated = true;
      },
    });
    if (inserted) {
      ensureNamedImports(ast, 'gt-next', ['GTProvider']);
    }
  }

  if (needsGetLocale) {
    ensureNamedImports(ast, 'gt-next/server', ['getLocale']);
  }

  // 4. Clean up imports orphaned by the guard removal (notFound, hasLocale,
  //    routing config imports).
  if (mutated) {
    removeUnusedNamedImports(ast, ['notFound', 'hasLocale', 'routing']);
  }

  if (!mutated && base.code === null) {
    return { code: null, todos, skipReasons: [], usedRich: base.usedRich };
  }
  if (!mutated) {
    return { ...base, todos };
  }

  const output = generate(
    ast,
    {
      retainLines: true,
      retainFunctionParens: true,
      comments: true,
      compact: 'auto',
    },
    working
  );
  return { code: output.code, todos, skipReasons: [], usedRich: base.usedRich };
}
