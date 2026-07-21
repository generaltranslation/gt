import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports, removeUnusedNamedImports } from './importUtils.js';
import { localePrefixHasCustomPrefixes } from './parseRoutingConfig.js';
import type { MigrationContext, SourceResult, TodoEntry } from './types.js';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;
const generate: typeof generateModule =
  (generateModule as { default?: typeof generateModule }).default ||
  generateModule;

const MIDDLEWARE_MODULE = 'next-intl/middleware';

/**
 * Swaps a plain `export default createMiddleware(routing)` middleware for
 * gt-next's createNextMiddleware, preserving the user's matcher config.
 * Middleware files with extra logic (auth chains etc.) are skipped whole.
 */
export function transformMiddlewareFile(
  file: string,
  code: string,
  ctx: MigrationContext
): SourceResult {
  const none: SourceResult = {
    code: null,
    todos: [],
    skipReasons: [],
  };
  if (!code.includes(MIDDLEWARE_MODULE)) return none;

  if (ctx.routing.localePrefix === 'never') {
    // A skip, not a todo: the untouched file still imports
    // next-intl/middleware, and only skippedFiles holds back the teardown
    // that would uninstall next-intl out from under it.
    return {
      ...none,
      skipReasons: [
        "localePrefix 'never' needs no gt-next middleware (locale resolution runs on cookies and headers without one), but this file still imports next-intl/middleware and holds back full teardown; delete or rewrite the middleware, then rerun the migration",
      ],
    };
  }

  if (ctx.routing.localePrefixUnresolved) {
    // A skip, not a todo, for the same reason as 'never' above: the untouched
    // file still imports next-intl/middleware, and only skippedFiles holds back
    // teardown. localePrefix is present but could not be statically resolved,
    // so converting would guess whether the default locale is prefixed.
    return {
      ...none,
      skipReasons: [
        "localePrefix could not be statically resolved (it references a variable or computed value), so converting the middleware would guess the app's public URL structure; inline a literal localePrefix in defineRouting (or convert the middleware by hand) and rerun the migration. The retained file still imports next-intl/middleware and holds back full teardown",
      ],
    };
  }

  if (ctx.routing.pathnamesUnresolved) {
    // A skip, not a todo, same rationale: pathConfig cannot be emitted from an
    // unresolved pathnames, and converting would silently drop the app's
    // localized pathnames.
    return {
      ...none,
      skipReasons: [
        'pathnames could not be statically resolved (it references a variable or computed value), so pathConfig cannot be emitted and converting would silently drop the localized pathnames; inline a literal pathnames in defineRouting (or convert the middleware by hand) and rerun the migration. The retained file still imports next-intl/middleware and holds back full teardown',
      ],
    };
  }

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

  let middlewareLocal: string | null = null;
  for (const statement of ast.program.body) {
    if (
      t.isImportDeclaration(statement) &&
      statement.source.value === MIDDLEWARE_MODULE
    ) {
      for (const specifier of statement.specifiers) {
        if (t.isImportDefaultSpecifier(specifier)) {
          middlewareLocal = specifier.local.name;
        }
      }
    }
  }
  if (!middlewareLocal) {
    return {
      ...none,
      skipReasons: ['next-intl/middleware import shape not recognized'],
    };
  }

  // Only imports, `export default createMiddleware(...)`, and
  // `export const config = ...` are supported; anything else is manual.
  let sawDefaultExport = false;
  for (const statement of ast.program.body) {
    if (t.isImportDeclaration(statement)) continue;
    if (
      t.isExportDefaultDeclaration(statement) &&
      t.isCallExpression(statement.declaration) &&
      t.isIdentifier(statement.declaration.callee, { name: middlewareLocal })
    ) {
      sawDefaultExport = true;
      continue;
    }
    if (
      t.isExportNamedDeclaration(statement) &&
      t.isVariableDeclaration(statement.declaration) &&
      statement.declaration.declarations.length === 1 &&
      t.isIdentifier(statement.declaration.declarations[0].id, {
        name: 'config',
      })
    ) {
      continue;
    }
    return {
      ...none,
      skipReasons: [
        'middleware.ts contains extra logic beyond createMiddleware (manual conversion)',
      ],
    };
  }
  if (!sawDefaultExport) {
    return {
      ...none,
      skipReasons: [
        'middleware.ts does not default-export createMiddleware(...) directly (manual conversion)',
      ],
    };
  }

  const mode = ctx.routing.localePrefix;
  const optionProperties: t.ObjectProperty[] = [];
  // next-intl defaults localePrefix to 'always': every locale is prefixed and
  // `/` redirects to `/<defaultLocale>`. gt-next's createNextMiddleware does
  // NOT prefix the default locale by default, so absent/'always' must set
  // prefixDefaultLocale: true to preserve the app's public URL structure.
  // 'as-needed' already matches gt-next's default (omit); 'never' never
  // reaches here (the early return above skips the file so the retained
  // next-intl middleware holds back teardown).
  if (mode === null || mode === 'always') {
    optionProperties.push(
      t.objectProperty(
        t.identifier('prefixDefaultLocale'),
        t.booleanLiteral(true)
      )
    );
  }
  if (ctx.routing.pathnames) {
    optionProperties.push(
      t.objectProperty(
        t.identifier('pathConfig'),
        t.valueToNode(ctx.routing.pathnames) as t.Expression
      )
    );
  }

  const todos: TodoEntry[] = [];
  if (localePrefixHasCustomPrefixes(ctx.routing.routingFile)) {
    todos.push({
      file,
      reason:
        'localePrefix.prefixes (per-locale URL prefix overrides) has no gt-next equivalent; the custom prefixes were dropped; restore them manually if the app relied on them.',
    });
  }

  traverse(ast, {
    ExportDefaultDeclaration(exportPath) {
      // next-intl's createMiddleware carries the routing config (either the
      // `routing` identifier or an inline next-intl config object). gt-next
      // derives its options from ctx.routing instead, so the original argument
      // is dropped and replaced with the gt-next options computed above. A
      // re-run can never reach here: the module-string guard above bails once
      // the file imports gt-next/middleware rather than next-intl/middleware.
      const call = t.callExpression(
        t.identifier('createNextMiddleware'),
        optionProperties.length > 0
          ? [t.objectExpression(optionProperties)]
          : []
      );
      exportPath.node.declaration = call;
    },
    ImportDeclaration(importPath) {
      if (importPath.node.source.value === MIDDLEWARE_MODULE) {
        importPath.remove();
      }
    },
  });

  ensureNamedImports(ast, 'gt-next/middleware', ['createNextMiddleware']);
  removeUnusedNamedImports(ast, ['routing']);

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
