import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports } from './importUtils.js';
import type { MigrationContext, SourceResult } from '../pipeline/types.js';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;
const generate: typeof generateModule =
  (generateModule as { default?: typeof generateModule }).default ||
  generateModule;

const PLUGIN_MODULE = 'next-intl/plugin';

/**
 * Replaces the createNextIntlPlugin wrapper in next.config.* with
 * withGTConfig, pointing gt-next's dictionary at the default-locale catalog.
 * While skipped files remain, the next-intl plugin is kept composed around
 * withGTConfig; the retained NextIntlClientProvider needs it to find the
 * request config at build time.
 */
export function transformNextConfigFile(
  file: string,
  code: string,
  ctx: MigrationContext
): SourceResult {
  const none: SourceResult = {
    code: null,
    todos: [],
    skipReasons: [],
  };
  if (!code.includes(PLUGIN_MODULE)) return none;
  const retainNextIntl = ctx.skippedFiles.size > 0;

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

  let pluginLocal: string | null = null;
  traverse(ast, {
    ImportDeclaration(importPath) {
      if (importPath.node.source.value !== PLUGIN_MODULE) return;
      for (const specifier of importPath.node.specifiers) {
        if (t.isImportDefaultSpecifier(specifier)) {
          pluginLocal = specifier.local.name;
        }
      }
      if (!retainNextIntl) importPath.remove();
    },
  });
  if (!pluginLocal) {
    return {
      ...none,
      skipReasons: ['next-intl/plugin import shape not recognized'],
    };
  }

  // `const withNextIntl = createNextIntlPlugin(...)` wrapper bindings.
  const wrapperNames = new Set<string>();
  traverse(ast, {
    VariableDeclarator(declPath) {
      const init = declPath.node.init;
      if (
        init &&
        t.isCallExpression(init) &&
        t.isIdentifier(init.callee, { name: pluginLocal! }) &&
        t.isIdentifier(declPath.node.id)
      ) {
        wrapperNames.add(declPath.node.id.name);
        if (!retainNextIntl) declPath.remove();
      }
    },
  });

  const dictionaryPath = relativeDictionaryPath(ctx);
  let rewrote = false;
  traverse(ast, {
    ExportDefaultDeclaration(exportPath) {
      const declaration = exportPath.node.declaration;
      if (!t.isCallExpression(declaration)) return;
      const callee = declaration.callee;
      const isWrapperCall =
        t.isIdentifier(callee) && wrapperNames.has(callee.name);
      const isInlineCall =
        t.isCallExpression(callee) &&
        t.isIdentifier(callee.callee, { name: pluginLocal! });
      if (!isWrapperCall && !isInlineCall) return;
      const inner = declaration.arguments[0];
      const config = t.isExpression(inner) ? inner : t.objectExpression([]);
      const gtCall = t.callExpression(t.identifier('withGTConfig'), [
        config,
        t.objectExpression([
          t.objectProperty(
            t.identifier('dictionary'),
            t.stringLiteral(dictionaryPath)
          ),
        ]),
      ]);
      if (retainNextIntl) {
        // Keep the next-intl plugin composed on the outside; it only injects
        // the request-config alias, which the retained provider still needs.
        declaration.arguments = [gtCall];
      } else {
        exportPath.node.declaration = gtCall;
      }
      rewrote = true;
    },
  });
  if (!rewrote) {
    return {
      ...none,
      skipReasons: [
        'next.config uses next-intl/plugin in an unrecognized way (manual conversion)',
      ],
    };
  }

  ensureNamedImports(ast, 'gt-next/config', ['withGTConfig']);

  const todos: SourceResult['todos'] = [];
  if (retainNextIntl) {
    todos.push({
      file,
      reason:
        'createNextIntlPlugin kept (composed around withGTConfig) because some files still use next-intl. Re-run ' +
        `\`gt migrate --from ${ctx.adapter.id}\` once they are converted to finish the teardown`,
    });
  }

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

function relativeDictionaryPath(ctx: MigrationContext): string {
  const absolute = path.join(
    ctx.catalogs.dir,
    `${ctx.catalogs.defaultLocale}.json`
  );
  const relative = path.relative(ctx.cwd, absolute).split(path.sep).join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}
