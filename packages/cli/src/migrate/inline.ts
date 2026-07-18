import { parse } from '@babel/parser';
import traverseModule, { type NodePath } from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { ensureNamedImports, removeUnusedNamedImports } from './importUtils.js';
import type { MigrationContext, SourceResult } from './types.js';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

/**
 * The --inline enhancement pass. Runs on already-compat-migrated code:
 * `t('key')` calls in JSX-child position whose message is pure static text
 * are replaced with the literal text and wrapped in <T>, matching what
 * `gt init` produces. Everything else stays on the (working) dictionary
 * path and is counted as a future candidate.
 */
export function inlinePass(
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

  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      tokens: true,
      createParenthesizedExpressions: true,
    });
  } catch {
    return none; // compat output always parses; never block on the extra pass
  }

  // t bindings created from gt-next's dictionary hooks (post-compat names).
  const tBindings = new Map<string, string | null>();
  traverse(ast, {
    VariableDeclarator(path) {
      let init = path.node.init;
      while (
        init &&
        (t.isAwaitExpression(init) || t.isParenthesizedExpression(init))
      ) {
        init = t.isAwaitExpression(init) ? init.argument : init.expression;
      }
      if (
        init &&
        t.isCallExpression(init) &&
        t.isIdentifier(init.callee) &&
        ['useTranslations', 'getTranslations'].includes(init.callee.name) &&
        t.isIdentifier(path.node.id)
      ) {
        const first = init.arguments[0];
        tBindings.set(
          path.node.id.name,
          t.isStringLiteral(first) ? first.value : null
        );
      }
    },
  });
  if (tBindings.size === 0) return none;

  const catalog = ctx.catalogs.byLocale[ctx.catalogs.defaultLocale] ?? {};
  let remaining = 0;

  // Phase 1: analyze only. Mutating mid-traversal made the <T> wrap skip
  // sibling calls inside the same element, so collect everything first.
  const conversions: {
    container: NodePath<t.JSXExpressionContainer>;
    message: string;
    element: NodePath<t.JSXElement> | null;
  }[] = [];
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee) || !tBindings.has(callee.name)) return;
      const [keyArg] = path.node.arguments;
      if (!t.isStringLiteral(keyArg)) {
        remaining += 1;
        return;
      }
      const message = resolve(
        catalog,
        tBindings.get(callee.name),
        keyArg.value
      );
      if (
        message === null ||
        ctx.adapter.classifyMessage(message).kind !== 'text'
      ) {
        remaining += 1;
        return;
      }
      if (path.node.arguments.length > 1) {
        remaining += 1;
        return;
      }
      const container = path.parentPath;
      if (
        !container.isJSXExpressionContainer() ||
        !(t.isJSXElement(container.parent) || t.isJSXFragment(container.parent))
      ) {
        remaining += 1;
        return;
      }
      conversions.push({
        container,
        message,
        element: container.findParent((parent) =>
          parent.isJSXElement()
        ) as NodePath<t.JSXElement> | null,
      });
    },
  });

  ctx.stats.inlineCandidatesRemaining =
    (ctx.stats.inlineCandidatesRemaining ?? 0) + remaining;
  if (conversions.length === 0) return none;
  const inlined = conversions.length;
  ctx.stats.inlined = (ctx.stats.inlined ?? 0) + inlined;

  // Phase 2: apply. Replace every container first, then wrap each distinct
  // enclosing element in <T> (replaceWith re-points the element's path at
  // the wrapper, so later insideT checks see earlier wraps).
  for (const conversion of conversions) {
    conversion.container.replaceWith(textNode(conversion.message));
  }
  const wrappedElements = new Set<NodePath<t.JSXElement>>();
  for (const conversion of conversions) {
    const element = conversion.element;
    // Dedupe by path identity: sibling containers share one element path,
    // and after replaceWith that path points at the new <T> wrapper.
    if (!element || wrappedElements.has(element)) continue;
    wrappedElements.add(element);
    if (insideT(element)) continue;
    if (t.isJSXIdentifier(element.node.openingElement.name, { name: 'T' })) {
      continue;
    }
    const wrapper = t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('T'), []),
      t.jsxClosingElement(t.jsxIdentifier('T')),
      [element.node]
    );
    element.replaceWith(wrapper);
  }

  // Drop t bindings with no remaining uses, then orphaned hook imports.
  // (Scope reference counts are stale after the replacements, so count by
  // hand: any identifier use outside the declarator itself.)
  const remainingUses = new Map<string, number>(
    [...tBindings.keys()].map((name) => [name, 0])
  );
  traverse(ast, {
    Identifier(path) {
      if (!remainingUses.has(path.node.name)) return;
      if (t.isVariableDeclarator(path.parent) && path.parent.id === path.node) {
        return;
      }
      remainingUses.set(path.node.name, remainingUses.get(path.node.name)! + 1);
    },
  });
  traverse(ast, {
    VariableDeclarator(path) {
      if (
        t.isIdentifier(path.node.id) &&
        tBindings.has(path.node.id.name) &&
        remainingUses.get(path.node.id.name) === 0
      ) {
        path.remove();
      }
    },
  });
  removeUnusedNamedImports(ast, ['useTranslations', 'getTranslations']);
  ensureNamedImports(ast, 'gt-next', ['T']);

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
  return {
    code: output.code,
    todos: [
      {
        file,
        reason: `${inlined} t() call(s) inlined into <T> — existing catalog translations for those keys no longer apply; regenerate with \`npx gt translate\``,
      },
    ],
    skipReasons: [],
    usedRich: false,
  };
}

function resolve(
  catalog: Record<string, unknown>,
  namespace: string | null | undefined,
  key: string
): string | null {
  const fullPath = namespace ? `${namespace}.${key}` : key;
  let current: unknown = catalog;
  for (const segment of fullPath.split('.')) {
    if (
      current === null ||
      typeof current !== 'object' ||
      !(segment in (current as Record<string, unknown>))
    ) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : null;
}

function textNode(message: string): t.JSXText | t.JSXExpressionContainer {
  return /[{}<>]/.test(message)
    ? t.jsxExpressionContainer(t.stringLiteral(message))
    : t.jsxText(message);
}

function insideT(path: NodePath<t.JSXElement>): boolean {
  let current: NodePath | null = path.parentPath;
  while (current) {
    if (
      current.isJSXElement() &&
      t.isJSXIdentifier(current.node.openingElement.name, { name: 'T' })
    ) {
      return true;
    }
    current = current.parentPath;
  }
  return false;
}
