import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
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
/**
 * True only for tests that validate a locale: a `hasLocale(...)` call, or an
 * `<array>.includes(<arg>)` call where the array expression mentions locales
 * or the argument is a bare `locale` identifier. Anything else (slug/origin
 * allowlists, feature checks) is application logic and must survive.
 */
function isLocaleGuardTest(test: t.Node): boolean {
  let guardsLocale = false;
  t.traverseFast(test, (node) => {
    if (!t.isCallExpression(node)) return;
    if (t.isIdentifier(node.callee, { name: 'hasLocale' })) {
      guardsLocale = true;
      return;
    }
    if (
      t.isMemberExpression(node.callee) &&
      !node.callee.computed &&
      t.isIdentifier(node.callee.property, { name: 'includes' })
    ) {
      const arraySource = generate(node.callee.object).code;
      const argument = node.arguments.length === 1 ? node.arguments[0] : null;
      const argumentIsLocale =
        (t.isIdentifier(argument) && /^locale$/i.test(argument.name)) ||
        (t.isMemberExpression(argument) &&
          !argument.computed &&
          t.isIdentifier(argument.property) &&
          /^locale$/i.test(argument.property.name));
      if (/locales/i.test(arraySource) || argumentIsLocale) {
        guardsLocale = true;
      }
    }
  });
  return guardsLocale;
}

/**
 * Finds the local name bound to the route `locale` param
 * (`const { locale } = await params` / `= params`, alias-aware), or null when
 * the layout does not destructure it. A retained NextIntlClientProvider reuses
 * this static, augmented-`Locale`-typed binding instead of a request-scoped
 * getLocale(). `props.params` and other non-`params` sources are ignored.
 */
function findParamLocaleBinding(ast: t.File): string | null {
  let binding: string | null = null;
  traverse(ast, {
    VariableDeclarator(path) {
      if (binding) return;
      if (!t.isObjectPattern(path.node.id)) return;
      const init = path.node.init;
      const fromParams =
        t.isIdentifier(init, { name: 'params' }) ||
        (t.isAwaitExpression(init) &&
          t.isIdentifier(init.argument, { name: 'params' }));
      if (!fromParams) return;
      for (const property of path.node.id.properties) {
        if (
          t.isObjectProperty(property) &&
          !property.computed &&
          t.isIdentifier(property.key, { name: 'locale' }) &&
          t.isIdentifier(property.value)
        ) {
          binding = property.value.name;
        }
      }
    },
  });
  return binding;
}

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
  //    `if (!locales.includes(locale)) notFound()` shapes. Full conversion
  //    only: gt-next middleware then owns locale resolution. In a partial
  //    migration next-intl is retained, and the guard both keeps runtime
  //    validation and narrows the route-param `locale` to the augmented
  //    `Locale` union that the retained NextIntlClientProvider expects, so it
  //    is left in place.
  if (!retainProvider) {
    traverse(ast, {
      IfStatement(path) {
        if (!isLocaleGuardTest(path.node.test)) return;
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
  }

  // 2. Keep `<html lang={locale}>` on the [locale] route param. Rewriting it
  //    to a request-scoped `await getLocale()` (reads headers/cookies) forces
  //    every route to render dynamically (ƒ) and loses static rendering (SSG);
  //    the param resolves statically via next/root-params. Record which param
  //    bindings the lang attribute uses so the unused-destructure cleanup in
  //    step 7 preserves them.
  const langParamBindings = new Set<string>();
  if (isLocaleLayout) {
    traverse(ast, {
      JSXAttribute(path) {
        if (!t.isJSXIdentifier(path.node.name, { name: 'lang' })) return;
        const value = path.node.value;
        if (!t.isJSXExpressionContainer(value)) return;
        const expression = value.expression;
        if (t.isIdentifier(expression)) {
          langParamBindings.add(expression.name);
        }
      },
    });
  }

  // 3. On a full migration the routing config file gets deleted, so inline
  //    its locale values where the layout still references them (typically
  //    `routing.locales` in generateStaticParams).
  if (!retainProvider) {
    const locales = ctx.routing.locales ?? ctx.catalogs.locales;
    const defaultLocale =
      ctx.routing.defaultLocale ?? ctx.catalogs.defaultLocale;
    traverse(ast, {
      MemberExpression(path) {
        if (
          path.node.computed ||
          !t.isIdentifier(path.node.object, { name: 'routing' }) ||
          !t.isIdentifier(path.node.property)
        ) {
          return;
        }
        if (path.node.property.name === 'locales') {
          path.replaceWith(
            t.arrayExpression(locales.map((locale) => t.stringLiteral(locale)))
          );
          mutated = true;
        } else if (path.node.property.name === 'defaultLocale') {
          path.replaceWith(t.stringLiteral(defaultLocale));
          mutated = true;
        }
      },
    });
  }

  // 4. A retained NextIntlClientProvider inherits its locale from the request
  //    config, which gt-next's middleware no longer populates — pass the
  //    resolved locale explicitly so skipped client components stay on the
  //    page's locale. Prefer the static route-param `locale` binding: it keeps
  //    SSG (no request-scoped read) and is typed to the augmented `Locale`
  //    union the provider's prop expects. Fall back to a request-scoped
  //    getLocale() only when no param locale is in scope (e.g. a root layout).
  if (retainProvider) {
    const paramLocaleBinding = findParamLocaleBinding(ast);
    traverse(ast, {
      JSXOpeningElement(path) {
        if (
          !t.isJSXIdentifier(path.node.name, {
            name: 'NextIntlClientProvider',
          })
        ) {
          return;
        }
        const hasLocaleProp = path.node.attributes.some(
          (attribute) =>
            t.isJSXAttribute(attribute) &&
            t.isJSXIdentifier(attribute.name, { name: 'locale' })
        );
        if (hasLocaleProp) return;
        const localeValue = paramLocaleBinding
          ? t.identifier(paramLocaleBinding)
          : t.awaitExpression(t.callExpression(t.identifier('getLocale'), []));
        path.node.attributes.push(
          t.jsxAttribute(
            t.jsxIdentifier('locale'),
            t.jsxExpressionContainer(localeValue)
          )
        );
        mutated = true;
        if (!paramLocaleBinding) {
          needsGetLocale = true;
          const fn = path.getFunctionParent();
          if (fn && !fn.node.async) {
            fn.node.async = true;
          }
        }
      },
    });
  }

  // 5. Ensure a GTProvider wraps the layout children.
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

  // 6. Clean up imports orphaned by the guard removal (notFound, hasLocale,
  //    routing config imports).
  if (mutated) {
    removeUnusedNamedImports(ast, ['notFound', 'hasLocale', 'routing']);
  }

  // 7. Guard removal can orphan `const { locale } = await params` — drop the
  //    declaration when nothing references its bindings anymore (it would
  //    trip no-unused-vars in user projects).
  if (mutated) {
    traverse(ast, {
      Program(path) {
        // Recrawl so bindings reflect the removals above.
        path.scope.crawl();
      },
      VariableDeclaration(path) {
        if (path.node.declarations.length !== 1) return;
        const declarator = path.node.declarations[0];
        if (!t.isObjectPattern(declarator.id)) return;
        const init = declarator.init;
        const fromParams =
          t.isIdentifier(init, { name: 'params' }) ||
          (t.isAwaitExpression(init) &&
            t.isIdentifier(init.argument, { name: 'params' }));
        if (!fromParams) return;
        for (const property of declarator.id.properties) {
          if (
            !t.isObjectProperty(property) ||
            !t.isIdentifier(property.value)
          ) {
            return;
          }
          // The `<html lang={...}>` param binding must survive even if guard
          // removal left it looking unreferenced to the recrawled scope.
          if (langParamBindings.has(property.value.name)) return;
          const binding = path.scope.getBinding(property.value.name);
          if (!binding || binding.referenced) return;
        }
        path.remove();
      },
    });
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
