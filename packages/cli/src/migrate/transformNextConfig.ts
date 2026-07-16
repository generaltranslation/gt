import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports } from './importUtils.js';
import type { MigrationContext, SourceResult } from './types.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

const PLUGIN_MODULE = 'next-intl/plugin';

/**
 * Replaces the createNextIntlPlugin wrapper in next.config.* with
 * withGTConfig, pointing gt-next's dictionary at the default-locale catalog.
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
    usedRich: false,
  };
  if (!code.includes(PLUGIN_MODULE)) return none;

  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      tokens: true,
      createParenthesizedExpressions: true,
    });
  } catch (error) {
    return { ...none, skipReasons: [`file could not be parsed: ${String(error)}`] };
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
      importPath.remove();
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
        declPath.remove();
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
      const config = t.isExpression(inner)
        ? inner
        : t.objectExpression([]);
      exportPath.node.declaration = t.callExpression(
        t.identifier('withGTConfig'),
        [
          config,
          t.objectExpression([
            t.objectProperty(
              t.identifier('dictionary'),
              t.stringLiteral(dictionaryPath)
            ),
          ]),
        ]
      );
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

function relativeDictionaryPath(ctx: MigrationContext): string {
  const absolute = path.join(
    ctx.catalogs.dir,
    `${ctx.catalogs.defaultLocale}.json`
  );
  const relative = path
    .relative(ctx.cwd, absolute)
    .split(path.sep)
    .join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}
