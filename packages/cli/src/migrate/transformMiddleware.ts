import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports, removeUnusedNamedImports } from './importUtils.js';
import type { MigrationContext, SourceResult } from './types.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

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
    usedRich: false,
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

  const optionProperties: t.ObjectProperty[] = [];
  if (ctx.routing.localePrefix === 'always') {
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

  traverse(ast, {
    ExportDefaultDeclaration(exportPath) {
      exportPath.node.declaration = t.callExpression(
        t.identifier('createNextMiddleware'),
        optionProperties.length > 0
          ? [t.objectExpression(optionProperties)]
          : []
      );
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
  return { code: output.code, todos: [], skipReasons: [], usedRich: false };
}
