import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

const traverse = traverseModule.default || traverseModule;

/** Parentheses on enum objects/keys control whether the host folds a member. */
export function preserveMemberParentheses(ast: t.File): void {
  traverse(ast, {
    MemberExpression(path) {
      for (const key of ['object', 'property'] as const) {
        const value = path.get(key);
        if (!value.isExpression() || !value.node.extra?.parenthesized) continue;
        value.node.extra = { ...value.node.extra, parenthesized: false };
        value.replaceWith(t.parenthesizedExpression(value.node));
      }
    },
  });
}
