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

/** See findExportedGtWrap. */
type ExistingGtWrap =
  | {
      kind: 'plugin-around-gt';
      exportDeclaration: t.ExportDefaultDeclaration;
      gtCall: t.CallExpression;
    }
  | { kind: 'other' };

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

  const print = (): string =>
    generate(
      ast,
      {
        retainLines: true,
        retainFunctionParens: true,
        comments: true,
        compact: 'auto',
      },
      code
    ).code;

  // Re-running gt migrate is the remediation this transform's own TODOs
  // prescribe ("re-run once they are converted to finish the teardown"), so a
  // config this run already wired must never be wrapped a second time: every
  // run appended another withGTConfig(...) around the last one, without bound.
  const existing = findExportedGtWrap(ast, wrapperNames, pluginLocal);
  if (existing) {
    if (existing.kind === 'plugin-around-gt' && !retainNextIntl) {
      // The teardown the earlier run promised: nothing uses next-intl any
      // more, so the plugin wrapper around the existing withGTConfig call can
      // go. The call itself (and the user's options in it) is left alone.
      existing.exportDeclaration.declaration = existing.gtCall;
      for (const declPath of wrapperDeclPaths) declPath.remove();
      for (const importPath of pluginImportPaths) importPath.remove();
      return {
        code: print(),
        todos: [
          {
            file,
            reason: `withGTConfig was already installed in this config, so it was left exactly as it is (dictionary path and options included) instead of being wrapped again. This run only removed the ${ctx.adapter.displayName} plugin wrapper around it, which no file needs now. Verify the options in the existing withGTConfig call still match your catalogs`,
          },
        ],
        skipReasons: [],
      };
    }
    // Left untouched. The source library's plugin is still composed inside the
    // exported value, so the emit phase must keep the library and its
    // request/routing files (same contract as the fallback wrap below).
    ctx.nextConfigRetainsPlugin = true;
    return {
      code: null,
      todos: [
        {
          file,
          reason: `already wired: this config's export is already wrapped in withGTConfig, so gt migrate left it untouched rather than wrapping it again. ${ctx.adapter.displayName}'s plugin is still composed in this file, so the package and its request/routing config stay installed; remove that plugin wrapper by hand and re-run \`gt migrate --from ${ctx.adapter.id}\` to finish the teardown`,
        },
      ],
      skipReasons: [],
    };
  }

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

  return { code: print(), todos, skipReasons: [] };
}

/**
 * The withGTConfig call already present in this config's EXPORTED value, if
 * any: the state of every re-run, since the first run put it there.
 *
 * `plugin-around-gt` is the shape the recognized swap produces while files
 * still use the source library (`withNextIntl(withGTConfig(cfg, {...}))`),
 * which a later run can finish tearing down. `other` covers everything else,
 * including the fallback whole-export wrap (`withGTConfig(async () => {...})`,
 * with the plugin call still inside the wrapped value): those must be left
 * exactly as they are.
 *
 * Callee recognition matches the wiring post-condition's (runMigration's
 * hasWithGTConfigCall): the literal name, an aliased named import
 * (`import { withGTConfig as w }`), and a namespace member
 * (`gt.withGTConfig(...)`). Scoped to the exported value on purpose: a
 * withGTConfig call elsewhere in the file is not the wiring, so a config whose
 * export is unwrapped still gets wrapped.
 */
function findExportedGtWrap(
  ast: t.File,
  wrapperNames: Set<string>,
  pluginLocal: string
): ExistingGtWrap | null {
  const gtNames = new Set(['withGTConfig']);
  for (const statement of ast.program.body) {
    if (!t.isImportDeclaration(statement)) continue;
    for (const specifier of statement.specifiers) {
      if (
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported, { name: 'withGTConfig' })
      ) {
        gtNames.add(specifier.local.name);
      }
    }
  }
  const isGtCall = (
    node: t.Node | null | undefined
  ): node is t.CallExpression =>
    t.isCallExpression(node) &&
    ((t.isIdentifier(node.callee) && gtNames.has(node.callee.name)) ||
      (t.isMemberExpression(node.callee) &&
        !node.callee.computed &&
        t.isIdentifier(node.callee.property, { name: 'withGTConfig' })));

  let result: ExistingGtWrap | null = null;
  const inspect = (
    value: t.Expression,
    exportDeclaration: t.ExportDefaultDeclaration | null
  ): void => {
    if (result) return;
    const inner = t.isCallExpression(value) ? value.arguments[0] : null;
    if (
      exportDeclaration &&
      t.isCallExpression(value) &&
      ((t.isIdentifier(value.callee) && wrapperNames.has(value.callee.name)) ||
        (t.isCallExpression(value.callee) &&
          t.isIdentifier(value.callee.callee, { name: pluginLocal }))) &&
      isGtCall(inner)
    ) {
      result = { kind: 'plugin-around-gt', exportDeclaration, gtCall: inner };
      return;
    }
    let found = false;
    // A gt call anywhere inside the exported value counts: the fallback wrap
    // nests it around a function whose body still holds the plugin call.
    t.traverseFast(value, (node) => {
      if (!found && isGtCall(node)) found = true;
    });
    if (found) result = { kind: 'other' };
  };

  traverse(ast, {
    ExportDefaultDeclaration(exportPath) {
      const declaration = exportPath.node.declaration;
      if (t.isExpression(declaration)) inspect(declaration, exportPath.node);
      else if (t.isFunctionDeclaration(declaration)) {
        // `export default function config() {...}`: never a gt wrap itself,
        // but its body could hold one (nothing to unwrap either way).
        inspect(t.functionExpression(null, [], declaration.body), null);
      }
    },
    AssignmentExpression(assignPath) {
      const { left, right } = assignPath.node;
      if (
        t.isMemberExpression(left) &&
        !left.computed &&
        t.isIdentifier(left.object, { name: 'module' }) &&
        t.isIdentifier(left.property, { name: 'exports' }) &&
        t.isExpression(right)
      ) {
        inspect(right, null);
      }
    },
  });
  return result;
}

function relativeDictionaryPath(ctx: MigrationContext): string {
  const absolute = path.join(
    ctx.catalogs.dir,
    `${ctx.catalogs.defaultLocale}.json`
  );
  const relative = path.relative(ctx.cwd, absolute).split(path.sep).join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}
