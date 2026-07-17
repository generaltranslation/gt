import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports, removeUnusedNamedImports } from './importUtils.js';
import { localePrefixHasCustomPrefixes } from './parseRoutingConfig.js';
import type { MigrationContext, SourceResult, TodoEntry } from './types.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

const MIDDLEWARE_MODULE = 'next-intl/middleware';

// Emitted above the converted `export default` when the source used
// localePrefix 'never'. Injected into the printed output (rather than attached
// to the AST) because babel's retainLines reflow strands a node-attached
// comment as a trailing comment on the import line instead of above the export.
const NEVER_MODE_TODO =
  " TODO(gt migrate): next-intl used localePrefix 'never' (no locale segment in the URL). gt-next has no equivalent — createNextMiddleware below prefixes non-default locales. Remove this middleware or adjust routing if you need locale-free URLs. ";

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
  // 'as-needed' already matches gt-next's default (omit); 'never' has no
  // gt-next equivalent (omit + TODO below).
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
  const neverMode = mode === 'never';
  if (neverMode) {
    todos.push({
      file,
      reason:
        "localePrefix 'never' has no gt-next equivalent: next-intl kept locales out of the URL entirely, but createNextMiddleware still prefixes non-default locales. Review whether these routes should stay locale-free (resolve the locale from cookies/headers instead) and adjust or remove the middleware.",
    });
  }
  if (localePrefixHasCustomPrefixes(ctx.routing.routingFile)) {
    todos.push({
      file,
      reason:
        'localePrefix.prefixes (per-locale URL prefix overrides) has no gt-next equivalent — the custom prefixes were dropped; restore them manually if the app relied on them.',
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
  const printed = neverMode
    ? insertCommentAboveExport(output.code, NEVER_MODE_TODO)
    : output.code;
  return { code: printed, todos, skipReasons: [], usedRich: false };
}

/**
 * Splices a block comment onto its own line directly above the converted
 * `export default createNextMiddleware(...)` line, matching that line's
 * indentation. Deterministic: the transform always emits exactly one such
 * export. If the marker isn't found the output is returned unchanged.
 */
function insertCommentAboveExport(code: string, comment: string): string {
  const lines = code.split('\n');
  const index = lines.findIndex((line) =>
    line.trimStart().startsWith('export default createNextMiddleware')
  );
  if (index === -1) return code;
  const line = lines[index];
  const indent = line.slice(0, line.length - line.trimStart().length);
  lines.splice(index, 0, `${indent}/*${comment}*/`);
  return lines.join('\n');
}
