import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports, removeUnusedNamedImports } from './importUtils.js';
import { isParamsInit, transformSourceFile } from './transformSource.js';
import type { MigrationContext, SourceResult, TodoEntry } from './types.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

/**
 * Layout files get the regular source transform plus layout-specific work:
 * locale-validation removal, `lang` -> getLocale(), and GTProvider
 * insertion/nesting. The driver runs layouts after every other file and
 * classifies them all to a fixed point before applying any edits, so
 * ctx.skippedFiles is final by the time a layout's output is written (it
 * decides whether NextIntlClientProvider is retained).
 */
/**
 * True only for tests that validate a locale: a `hasLocale(...)` call, or an
 * `<array>.includes(<arg>)` call where the array expression mentions locales
 * or the argument is a bare `locale` identifier. Anything else (slug/origin
 * allowlists, feature checks) is application logic and must survive.
 */
function isLocaleGuardTest(
  test: t.Node,
  localeValidators: Set<string>
): boolean {
  let guardsLocale = false;
  t.traverseFast(test, (node) => {
    if (!t.isCallExpression(node)) return;
    if (t.isIdentifier(node.callee) && localeValidators.has(node.callee.name)) {
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
 * Every local binding of the route `locale` param in the file
 * (`const { locale } = await params` / `= params` / `= use(params)`,
 * alias-aware), each paired with the declarator node that introduced it. A retained
 * NextIntlClientProvider reuses whichever of these is actually in scope at its
 * own injection site (a static, augmented-`Locale`-typed binding), which keeps
 * SSG and avoids a request-scoped getLocale(). Recording the declarator lets
 * the injection site confirm scope via `scope.getBinding(name)` rather than
 * trusting a name that may be bound in an unrelated function (e.g.
 * generateMetadata). `props.params` and other non-`params` sources are ignored.
 */
function collectParamLocaleBindings(
  ast: t.File
): Array<{ name: string; declarator: t.VariableDeclarator }> {
  const bindings: Array<{ name: string; declarator: t.VariableDeclarator }> =
    [];
  traverse(ast, {
    VariableDeclarator(path) {
      if (!t.isObjectPattern(path.node.id)) return;
      if (!isParamsInit(path.node.init)) return;
      for (const property of path.node.id.properties) {
        if (
          t.isObjectProperty(property) &&
          !property.computed &&
          t.isIdentifier(property.key, { name: 'locale' }) &&
          t.isIdentifier(property.value)
        ) {
          bindings.push({ name: property.value.name, declarator: path.node });
        }
      }
    },
  });
  return bindings;
}

/**
 * The layout's default-exported component function — the function Next.js
 * awaits when it renders the route. Handles both the inline form
 * (`export default function Layout() {}` / `export default () => {}`) and the
 * by-reference form (`const Layout = () => {}; export default Layout;`).
 * Returns the function node, or null when the default export is not a function
 * (or is missing). Used by the getLocale() fallback to decide whether an
 * enclosing function can safely be marked async: doing so is only safe on this
 * component (awaited by Next.js) or a function that is already async.
 */
function findDefaultExportFunction(ast: t.File): t.Function | null {
  let result: t.Function | null = null;
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration;
      if (
        t.isFunctionDeclaration(declaration) ||
        t.isArrowFunctionExpression(declaration) ||
        t.isFunctionExpression(declaration)
      ) {
        result = declaration;
        return;
      }
      if (!t.isIdentifier(declaration)) return;
      const binding = path.scope.getBinding(declaration.name);
      if (!binding) return;
      const node = binding.path.node;
      if (t.isFunctionDeclaration(node)) {
        result = node;
      } else if (
        t.isVariableDeclarator(node) &&
        (t.isArrowFunctionExpression(node.init) ||
          t.isFunctionExpression(node.init))
      ) {
        result = node.init;
      }
    },
  });
  return result;
}

/**
 * Drop the `params` parameter from a function whose only use of it was an
 * orphaned `const { ... } = await params` that step 7 just removed. The usual
 * shape is an ObjectPattern parameter (`{ children, params }`): remove just the
 * `params` property, which never changes arity. If that would empty the pattern,
 * remove the whole parameter only when it is last (an empty `{}` trips
 * no-empty-pattern, and dropping a non-last positional param shifts the others).
 * TypeScript annotations are left untouched: an unused type member does not lint.
 */
function removeParamsParameter(fn: t.Function): void {
  const params = fn.params;
  for (let index = 0; index < params.length; index++) {
    const param = params[index];
    if (t.isIdentifier(param, { name: 'params' })) {
      if (index === params.length - 1) params.splice(index, 1);
      return;
    }
    if (!t.isObjectPattern(param)) continue;
    const propertyIndex = param.properties.findIndex(
      (property) =>
        t.isObjectProperty(property) &&
        !property.computed &&
        t.isIdentifier(property.value, { name: 'params' })
    );
    if (propertyIndex === -1) continue;
    // A rest sibling would absorb the removed key at runtime (`...rest` gains
    // `params`), so keep the parameter in that shape; the lint warning is the
    // lesser evil to a behavior change.
    if (param.properties.some((property) => t.isRestElement(property))) {
      return;
    }
    if (param.properties.length === 1) {
      if (index === params.length - 1) params.splice(index, 1);
      return;
    }
    param.properties.splice(propertyIndex, 1);
    return;
  }
}

export function transformLayoutFile(
  file: string,
  code: string,
  ctx: MigrationContext
): SourceResult {
  const adapter = ctx.adapter;
  const retainProvider = ctx.skippedFiles.size > 0;
  const base = transformSourceFile(file, code, ctx, {
    retainProvider,
    dropLocaleValidation: true,
    // Opt out of the base pass's orphaned param-locale cleanup: step 4 below can
    // inject `locale={locale}` into a retained NextIntlClientProvider, which
    // references the param destructure that looks dead at base-pass time.
    // Cleaning it here would demote SSG to a request-scoped getLocale(); layouts
    // run their own step-7 cleanup after that injection instead.
    dropOrphanedParamLocale: false,
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
    };
  }

  const todos: TodoEntry[] = [...base.todos];
  let mutated = false;
  let needsGetLocale = false;
  const isLocaleLayout = file.includes('[locale]');

  // Client-component layouts can't take the server-side work below:
  // `await getLocale()` is server-only, and forcing the component async
  // would make it an invalid async client component. Keep the source
  // transform's output as is and flag the provider for manual wiring.
  const isClientLayout = ast.program.directives.some(
    (directive) => directive.value.value === 'use client'
  );
  if (isClientLayout) {
    if (retainProvider && working.includes('NextIntlClientProvider')) {
      todos.push({
        file,
        reason:
          'client-component layout keeps NextIntlClientProvider: pass its locale from a server parent (await getLocale()); the automatic injection only applies to server layouts',
      });
    }
    if (working.includes('<body')) {
      todos.push({
        file,
        reason:
          'client-component layout renders <body>: GTProvider was not inserted automatically (client components are left alone); add it around the app children yourself',
      });
    }
    return { ...base, todos };
  }

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
        if (!isLocaleGuardTest(path.node.test, adapter.localeValidators)) {
          return;
        }
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
  //    getLocale() only when no param locale is in scope (e.g. a root layout),
  //    and only when it is safe to make the enclosing function async: the
  //    function is already async, or it is the layout's default-exported
  //    component (which Next.js awaits). Inside any other shape — a nested sync
  //    helper, a callback, a class method — marking the function async would
  //    leave its unchanged synchronous call site rendering a pending Promise
  //    (an invalid React child), so skip the layout instead. Partial mode keeps
  //    next-intl installed, so the skipped layout keeps working on it and the
  //    skip surfaces in the report for a manual fix.
  if (retainProvider) {
    const paramLocaleBindings = collectParamLocaleBindings(ast);
    // Any retained provider may need the getLocale() fallback (one whose scope
    // has no param locale), so resolve the default-exported component up front
    // rather than only when the file lacks a params destructure entirely.
    const componentFn = findDefaultExportFunction(ast);
    let unsafeAsyncFallback = false;
    traverse(ast, {
      JSXOpeningElement(path) {
        if (unsafeAsyncFallback) return;
        if (
          adapter.providerName === null ||
          !t.isJSXIdentifier(path.node.name, { name: adapter.providerName })
        ) {
          return;
        }
        const hasLocaleProp = path.node.attributes.some(
          (attribute) =>
            t.isJSXAttribute(attribute) &&
            t.isJSXIdentifier(attribute.name, { name: 'locale' })
        );
        if (hasLocaleProp) return;

        // Primary path: reuse a static route-param binding, no async needed,
        // but only one actually in scope at THIS provider. A binding found
        // file-wide (e.g. destructured inside generateMetadata) is an
        // undefined reference here, so resolve the name up the provider's own
        // scope chain and accept it only when it maps back to a recorded
        // params destructure.
        const inScopeParamLocale = paramLocaleBindings.find(
          ({ name, declarator }) =>
            path.scope.getBinding(name)?.path.node === declarator
        );
        if (inScopeParamLocale) {
          path.node.attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier('locale'),
              t.jsxExpressionContainer(t.identifier(inScopeParamLocale.name))
            )
          );
          mutated = true;
          return;
        }

        // Fallback path: `await getLocale()` needs an async function. Only
        // mutate one we know Next.js awaits (the component) or that is already
        // async; anything else degrades to a skip.
        const fn = path.getFunctionParent();
        if (!fn || (!fn.node.async && fn.node !== componentFn)) {
          unsafeAsyncFallback = true;
          return;
        }
        path.node.attributes.push(
          t.jsxAttribute(
            t.jsxIdentifier('locale'),
            t.jsxExpressionContainer(
              t.awaitExpression(t.callExpression(t.identifier('getLocale'), []))
            )
          )
        );
        mutated = true;
        needsGetLocale = true;
        if (!fn.node.async) {
          fn.node.async = true;
        }
      },
    });
    if (unsafeAsyncFallback) {
      const providerLabel =
        adapter.providerName ?? `${adapter.displayName} provider`;
      return {
        code: null,
        todos: [],
        skipReasons: [
          `retained ${providerLabel} has no route \`locale\` param in scope and sits inside a synchronous helper that cannot be made async safely; pass its \`locale\` prop manually (the layout keeps working on ${adapter.displayName} until then)`,
        ],
      };
    }
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
    } else if (/\[locale\][\\/]layout\.[^\\/]+$/.test(file)) {
      // Only the root [locale] layout is expected to carry <body>; nested
      // layouts without one are normal and stay quiet.
      todos.push({
        file,
        reason:
          'GTProvider was not added automatically (no <body> element found in this layout): wrap the layout children in <GTProvider> yourself',
      });
    }
  }

  if (needsGetLocale) {
    ensureNamedImports(ast, 'gt-next/server', ['getLocale']);
  }

  // 6. Clean up imports orphaned by the guard removal (notFound, hasLocale,
  //    routing config imports).
  if (mutated) {
    removeUnusedNamedImports(ast, [
      'notFound',
      ...adapter.localeValidators,
      'routing',
    ]);
  }

  // 7. Guard removal can orphan `const { locale } = await params` (or the
  //    React 19 `use(params)` form): drop the declaration when nothing
  //    references its bindings anymore (it would trip no-unused-vars in user
  //    projects), then drop the now-unused `params` parameter from the same
  //    function so the cleanup does not just move the unused-variable warning
  //    from the destructure to the signature.
  if (mutated) {
    // Functions whose orphaned params destructure was removed here; each one's
    // `params` parameter may now be unreferenced and need dropping.
    const paramsCleanupTargets = new Set<t.Function>();
    let removedParamsDestructure = false;
    traverse(ast, {
      Program(path) {
        // Recrawl so bindings reflect the removals above.
        path.scope.crawl();
      },
      VariableDeclaration(path) {
        if (path.node.declarations.length !== 1) return;
        const declarator = path.node.declarations[0];
        if (!t.isObjectPattern(declarator.id)) return;
        if (!isParamsInit(declarator.init)) return;
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
        const fn = path.getFunctionParent();
        if (fn) paramsCleanupTargets.add(fn.node);
        path.remove();
        removedParamsDestructure = true;
      },
    });

    // Now drop any `params` parameter left unreferenced by those removals. A
    // fresh crawl is required so the removed `await params` no longer counts as
    // a reference; then each cleaned function's own `params` binding decides.
    // Only that function's params is touched: a sibling generateMetadata that
    // still reads its own params keeps its own, separately-scoped binding.
    if (paramsCleanupTargets.size > 0) {
      traverse(ast, {
        Program(path) {
          path.scope.crawl();
        },
        Function(path) {
          if (!paramsCleanupTargets.has(path.node)) return;
          const binding = path.scope.getBinding('params');
          if (!binding || binding.kind !== 'param' || binding.referenced) {
            return;
          }
          removeParamsParameter(path.node);
        },
      });
    }

    // A removed `use(params)` destructure may have been the last reference to
    // the react `use` import; the helper only drops unreferenced names.
    if (removedParamsDestructure) {
      removeUnusedNamedImports(ast, ['use']);
    }
  }

  if (!mutated && base.code === null) {
    return { code: null, todos, skipReasons: [] };
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
  return { code: output.code, todos, skipReasons: [] };
}
