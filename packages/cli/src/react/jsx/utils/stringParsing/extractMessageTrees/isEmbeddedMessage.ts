import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { getHelperName } from './imports.js';

const OPTION_KEYS = new Set(['context', 'maxChars', 'requiresReview']);

/**
 * Whether the compiler embeds this message's translations at its call site
 * for `files.gt.inlineTranslations.locales`. Both @generaltranslation/compiler
 * and the gt-next SWC plugin embed exactly these call sites:
 * - The tag is `t` imported from an unstable source, or the `gt` of
 *   `const gt = useGT()` / `const gt = await getGT()` from one, optionally
 *   called with one object of literal options with identifier keys.
 * - Every hole is a named variable, like `${{ name }}`.
 *
 * Aliases, configured tags (`const save = gt({ ... })`), `msg`, derive and
 * other holes are left to loaded translations.
 */
export function isEmbeddedMessage(
  tagged: NodePath<t.TaggedTemplateExpression>
): boolean {
  const tag = tagged.get('tag');
  let callee: NodePath = tag;
  if (tag.isCallExpression()) {
    const { arguments: args } = tag.node;
    if (args.length !== 1 || !hasLiteralOptions(args[0])) return false;
    callee = tag.get('callee');
  }
  if (!isEmbeddedTag(callee)) return false;
  return tagged.node.quasi.expressions.every(isNamedVariable);
}

function isEmbeddedTag(callee: NodePath): boolean {
  if (!callee.isIdentifier()) return false;
  if (getHelperName(callee) === 't') return true;
  const binding = callee.scope.getBinding(callee.node.name);
  if (
    !binding?.constant ||
    !binding.path.isVariableDeclarator() ||
    !t.isIdentifier(binding.path.node.id)
  ) {
    return false;
  }
  let init = binding.path.get('init');
  if (init.isAwaitExpression()) init = init.get('argument');
  if (!init.isCallExpression()) return false;
  const hook = getHelperName(init.get('callee'));
  return hook === 'useGT' || hook === 'getGT';
}

function hasLiteralOptions(node: t.Node): boolean {
  return (
    t.isObjectExpression(node) &&
    node.properties.every(
      (property) =>
        t.isObjectProperty(property) &&
        !property.computed &&
        t.isIdentifier(property.key) &&
        OPTION_KEYS.has(property.key.name) &&
        isLiteralOption(property.key.name, property.value)
    )
  );
}

function isLiteralOption(key: string, value: t.Node): boolean {
  switch (key) {
    case 'context':
      return (
        t.isStringLiteral(value) ||
        (t.isTemplateLiteral(value) && value.expressions.length === 0)
      );
    case 'maxChars': {
      const number = t.isUnaryExpression(value, { operator: '-' })
        ? value.argument
        : value;
      // The SWC plugin reads it as a 64-bit integer
      return t.isNumericLiteral(number) && Number.isSafeInteger(number.value);
    }
    default:
      return t.isBooleanLiteral(value);
  }
}

/** `${{ name }}` or `${{ name: value }}`, with TypeScript wrappers removed. */
function isNamedVariable(hole: t.Expression | t.TSType): boolean {
  let node: t.Node = hole;
  while (
    t.isTSAsExpression(node) ||
    t.isTSSatisfiesExpression(node) ||
    t.isTSNonNullExpression(node) ||
    t.isTSTypeAssertion(node) ||
    t.isParenthesizedExpression(node)
  ) {
    node = node.expression;
  }
  if (!t.isObjectExpression(node) || node.properties.length !== 1) {
    return false;
  }
  const [property] = node.properties;
  if (!t.isObjectProperty(property) || property.computed) return false;
  const { key } = property;
  const name = t.isIdentifier(key)
    ? key.name
    : t.isStringLiteral(key)
      ? key.value
      : t.isNumericLiteral(key)
        ? String(key.value)
        : undefined;
  // The compilers leave every __proto__ key to the runtime, shorthand too
  return name !== undefined && name !== '__proto__';
}
