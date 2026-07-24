import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule, { type NodePath } from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports } from './importUtils.js';
import { buildGtOptionsExpression } from './gtOptions.js';
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

  // Collect the plugin import and wrapper bindings WITHOUT removing anything
  // yet: whether they can go depends on which rewrite path below succeeds (the
  // fallback wrap keeps the plugin composed inside the exported value, where
  // deleting its import would break the file).
  let pluginLocal: string | null = null;
  const pluginImportPaths: NodePath<t.ImportDeclaration>[] = [];
  traverse(ast, {
    ImportDeclaration(importPath) {
      if (importPath.node.source.value !== PLUGIN_MODULE) return;
      for (const specifier of importPath.node.specifiers) {
        if (t.isImportDefaultSpecifier(specifier)) {
          pluginLocal = specifier.local.name;
        }
      }
      pluginImportPaths.push(importPath);
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
  const wrapperDeclPaths: NodePath<t.VariableDeclarator>[] = [];
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
        wrapperDeclPaths.push(declPath);
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
        buildGtOptionsExpression(ctx, dictionaryPath),
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
  // The recognized shape consumed the plugin call, so on a full migration the
  // plugin import and its wrapper bindings can finally go (deferred from the
  // collection passes above; the fallback below must NOT reach this state).
  if (rewrote && !retainNextIntl) {
    for (const declPath of wrapperDeclPaths) declPath.remove();
    for (const importPath of pluginImportPaths) importPath.remove();
  }

  // Fallback for export shapes the plugin swap above cannot restructure: a
  // function default export (a composed async config), an identifier, a
  // foreign compose call, or a CJS module.exports. withGTConfig natively
  // accepts a function config (it resolves the function's result, sync or
  // async, and re-wraps it), so wrapping the WHOLE exported value is safe
  // without touching the body. The next-intl plugin stays composed inside
  // that value, so ctx.nextConfigRetainsPlugin tells the emit phase to keep
  // next-intl installed and its request/routing files on disk; without this
  // path, the run converted every consumer to gt-next while never installing
  // withGTConfig, and each locale route 500'd at runtime (the round-7 Memo
  // Engine failure).
  let wrappedWholeExport = false;
  if (!rewrote) {
    const gtCallOf = (expr: t.Expression): t.CallExpression =>
      t.callExpression(t.identifier('withGTConfig'), [
        expr,
        buildGtOptionsExpression(ctx, dictionaryPath),
      ]);
    traverse(ast, {
      ExportDefaultDeclaration(exportPath) {
        if (rewrote) return;
        const declaration = exportPath.node.declaration;
        if (t.isFunctionDeclaration(declaration)) {
          if (declaration.id) {
            // Named: demote to a plain declaration (its name may be
            // self-referenced), then default-export the wrapped reference.
            exportPath.replaceWithMultiple([
              declaration,
              t.exportDefaultDeclaration(
                gtCallOf(t.identifier(declaration.id.name))
              ),
            ]);
          } else {
            // Anonymous: re-shape into a function expression and wrap inline.
            exportPath.node.declaration = gtCallOf(
              t.functionExpression(
                null,
                declaration.params,
                declaration.body,
                declaration.generator,
                declaration.async
              )
            );
          }
          rewrote = true;
          wrappedWholeExport = true;
          return;
        }
        if (t.isExpression(declaration)) {
          exportPath.node.declaration = gtCallOf(declaration);
          rewrote = true;
          wrappedWholeExport = true;
        }
      },
    });
    if (!rewrote) {
      // CJS: module.exports = <expr>.
      traverse(ast, {
        AssignmentExpression(assignPath) {
          if (rewrote) return;
          const { left, right } = assignPath.node;
          if (
            t.isMemberExpression(left) &&
            !left.computed &&
            t.isIdentifier(left.object, { name: 'module' }) &&
            t.isIdentifier(left.property, { name: 'exports' }) &&
            t.isExpression(right)
          ) {
            assignPath.node.right = gtCallOf(right);
            rewrote = true;
            wrappedWholeExport = true;
          }
        },
      });
    }
  }
  if (!rewrote) {
    return {
      ...none,
      skipReasons: [
        'next.config uses next-intl/plugin in an unrecognized way (manual conversion)',
      ],
    };
  }

  // A wrapped module.exports config is CJS; an ESM import statement would not
  // load there, so inject the require form instead.
  const usesCjsExport =
    !/\bexport\s+default\b/.test(code) && wrappedWholeExport;
  if (usesCjsExport) {
    ast.program.body.unshift(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.objectPattern([
            t.objectProperty(
              t.identifier('withGTConfig'),
              t.identifier('withGTConfig'),
              false,
              true
            ),
          ]),
          t.callExpression(t.identifier('require'), [
            t.stringLiteral('gt-next/config'),
          ])
        ),
      ])
    );
  } else {
    ensureNamedImports(ast, 'gt-next/config', ['withGTConfig']);
  }

  const todos: SourceResult['todos'] = [];
  if (wrappedWholeExport) {
    // The plugin call still lives inside the wrapped value; the emit phase
    // reads this flag to keep next-intl installed and its request/routing
    // files on disk, so the retained composition keeps resolving.
    ctx.nextConfigRetainsPlugin = true;
    todos.push({
      file,
      reason:
        'this config exports a shape gt migrate cannot restructure (a function or composed value), so withGTConfig now wraps the whole export and createNextIntlPlugin stays composed inside it. next-intl and its request/routing config stay installed; once you remove the plugin from the config by hand, re-run ' +
        `\`gt migrate --from ${ctx.adapter.id}\` to finish the teardown`,
    });
  } else if (retainNextIntl) {
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
