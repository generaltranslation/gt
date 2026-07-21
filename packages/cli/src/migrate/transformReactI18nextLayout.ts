import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports } from './importUtils.js';
import { transformReactI18nextSource } from './transformReactI18nextSource.js';
import type { MigrationContext, SourceResult } from './types.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

/**
 * Layout pass for react-i18next: run the client source transform, then make
 * sure a <GTProvider> wraps the layout's <body> children so client components
 * using useTranslations resolve their dictionary. Unlike next-intl there is no
 * hasLocale guard, no `routing` object, and no NextIntlClientProvider retention
 * to unwind — react-i18next layouts render `<html lang={param}>` and children,
 * and the [locale]/[lng] static-rendering handling is done by emitGtFiles.
 */
export function transformReactI18nextLayout(
  file: string,
  code: string,
  ctx: MigrationContext
): SourceResult {
  const retainProvider = ctx.skippedFiles.size > 0;
  const base = transformReactI18nextSource(file, code, ctx, { retainProvider });
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

  let hasGtProvider = false;
  traverse(ast, {
    JSXIdentifier(path) {
      if (path.node.name === 'GTProvider') hasGtProvider = true;
    },
  });

  let mutated = false;
  if (!hasGtProvider) {
    traverse(ast, {
      JSXElement(path) {
        if (mutated) return;
        const name = path.node.openingElement.name;
        if (!t.isJSXIdentifier(name, { name: 'body' })) return;
        const provider = t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('GTProvider'), []),
          t.jsxClosingElement(t.jsxIdentifier('GTProvider')),
          path.node.children
        );
        path.node.children = [provider];
        mutated = true;
      },
    });
    if (mutated) ensureNamedImports(ast, 'gt-next', ['GTProvider']);
  }

  if (!mutated) {
    return base.code === null
      ? { code: null, todos: base.todos, skipReasons: [] }
      : base;
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
  return {
    code: output.code,
    todos: base.todos,
    skipReasons: [],
  };
}
