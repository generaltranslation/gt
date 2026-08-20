import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
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

/**
 * Wraps an existing next.config's exported config in `withGTConfig`, pointing
 * gt-next's dictionary at the converted default-locale catalog. Unlike next-intl
 * there is no i18n plugin to swap out; a raw react-i18next app has a plain
 * next.config; so this ADDS withGTConfig around whatever the app exports.
 * Handles both ESM (`export default ...`) and CJS (`module.exports = ...`);
 * anything else is left untouched with an actionable TODO rather than a guess.
 */
export function transformReactI18nextNextConfig(
  file: string,
  code: string,
  ctx: MigrationContext
): SourceResult {
  const none: SourceResult = {
    code: null,
    todos: [],
    skipReasons: [],
  };

  // Already migrated (idempotent re-run): leave it.
  if (code.includes('withGTConfig')) return none;

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

  const dictionaryPath = relativeDictionaryPath(ctx);
  const gtOptions = buildGtOptionsExpression(ctx, dictionaryPath);
  const wrap = (config: t.Expression): t.CallExpression =>
    t.callExpression(t.identifier('withGTConfig'), [config, gtOptions]);

  let rewrote = false;
  let isCjs = false;

  // ESM: export default <expr> (withGTConfig accepts a function config
  // natively, so function expressions and declarations wrap the same way; a
  // named declaration is demoted first so self-references stay valid).
  traverse(ast, {
    ExportDefaultDeclaration(exportPath) {
      // Babel also visits nodes this visitor just inserted: after the
      // function-declaration branch below replaces the export with
      // [declaration, export default withGTConfig(...)], the new export node
      // comes through here again and the expression branch would wrap it a
      // second time (withGTConfig(withGTConfig(...))). One wrap per file.
      if (rewrote) return;
      const declaration = exportPath.node.declaration;
      if (t.isFunctionDeclaration(declaration)) {
        if (declaration.id) {
          exportPath.replaceWithMultiple([
            declaration,
            t.exportDefaultDeclaration(wrap(t.identifier(declaration.id.name))),
          ]);
        } else {
          exportPath.node.declaration = wrap(
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
        return;
      }
      if (!t.isExpression(declaration)) return;
      exportPath.node.declaration = wrap(declaration);
      rewrote = true;
    },
  });

  // CJS: module.exports = <expr>.
  if (!rewrote) {
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
          assignPath.node.right = wrap(right);
          rewrote = true;
          isCjs = true;
        }
      },
    });
  }

  if (!rewrote) {
    // A skip, not a TODO: converted consumers depend on withGTConfig for
    // dictionary and locale resolution, so a config left unwrapped means the
    // migration must not proceed (the driver turns a config-lane failure into
    // a hard stop with this reason).
    return {
      ...none,
      skipReasons: [
        "could not find a default export / module.exports to wrap; add `withGTConfig(yourConfig, { dictionary: '" +
          dictionaryPath +
          "' })` from gt-next/config to next.config manually, then re-run gt migrate",
      ],
    };
  }

  if (isCjs) {
    // `const { withGTConfig } = require('gt-next/config');` at the top.
    const requireDecl = t.variableDeclaration('const', [
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
    ]);
    ast.program.body.unshift(requireDecl);
  } else {
    ensureNamedImports(ast, 'gt-next/config', ['withGTConfig']);
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
  return { code: output.code, todos: [], skipReasons: [] };
}

function relativeDictionaryPath(ctx: MigrationContext): string {
  const absolute = path.join(
    ctx.catalogs.dir,
    `${ctx.catalogs.defaultLocale}.json`
  );
  const relative = path.relative(ctx.cwd, absolute).split(path.sep).join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}
