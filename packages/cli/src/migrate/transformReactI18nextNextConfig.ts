import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports } from './importUtils.js';
import type { MigrationContext, SourceResult } from './types.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

/**
 * Wraps an existing next.config's exported config in `withGTConfig`, pointing
 * gt-next's dictionary at the converted default-locale catalog. Unlike next-intl
 * there is no i18n plugin to swap out — a raw react-i18next app has a plain
 * next.config — so this ADDS withGTConfig around whatever the app exports.
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
  const gtOptions = t.objectExpression([
    t.objectProperty(
      t.identifier('dictionary'),
      t.stringLiteral(dictionaryPath)
    ),
  ]);
  const wrap = (config: t.Expression): t.CallExpression =>
    t.callExpression(t.identifier('withGTConfig'), [config, gtOptions]);

  let rewrote = false;
  let isCjs = false;

  // ESM: export default <expr>.
  traverse(ast, {
    ExportDefaultDeclaration(exportPath) {
      const declaration = exportPath.node.declaration;
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
    return {
      ...none,
      code: null,
      todos: [
        {
          file,
          reason:
            "could not find a default export / module.exports to wrap — add `withGTConfig(yourConfig, { dictionary: '" +
            dictionaryPath +
            "' })` from gt-next/config to next.config manually (gt-next needs it to load the dictionary and run its compiler plugin)",
        },
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
