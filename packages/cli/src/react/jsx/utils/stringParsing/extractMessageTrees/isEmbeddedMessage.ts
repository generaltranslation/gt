import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
  DATE_TIME_CONTEXT_OPTIONS,
  NUMBER_CONTEXT_OPTIONS,
} from '@generaltranslation/icu/internal';
import { embedsUnstableGTHelperTemplates } from 'generaltranslation/internal';
import { getHelperName, getNamedImport } from './imports.js';
import { getNumber } from './staticValues.js';

const OPTION_KEYS = new Set(['context', 'maxChars', 'requiresReview']);

/**
 * Whether the compiler embeds this message's translations at its call site
 * for `files.gt.inlineTranslations.locales`. Both @generaltranslation/compiler
 * and the gt-next SWC plugin embed exactly these call sites:
 * - The tag is `t` imported from an unstable source, or the `gt` of
 *   `const gt = useGT()` / `const gt = await getGT()` from one, declared
 *   earlier in the source, optionally called with one object of literal
 *   options with identifier keys.
 * - Every hole is a named variable, like `${{ name }}`.
 *
 * For a tag of an entry only @generaltranslation/compiler builds (see
 * embedsUnstableGTHelperTemplates), a hole may also be a helper the compiler
 * reads from the call site alone, as long as each value has a name: `n`, an
 * inline part`...`, `plural`, `selectordinal` or `select` with literal or
 * inline part branches, and `number`, `date` or `time` with literal options.
 * This mirrors isEmbeddedHole in
 * packages/compiler/src/transform/injection/injectUnstableTaggedTemplateHash.ts,
 * and test-fixtures/embedded-message-templates.json keeps both on the same
 * answer.
 *
 * Aliases, configured tags (`const save = gt({ ... })`), `msg`, derive,
 * values without a name and anything this extractor resolves beyond the call
 * site, such as a part behind a constant, are left to loaded translations.
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
  const source = getEmbeddedTagSource(callee);
  if (source === undefined) return false;
  const helpers = embedsUnstableGTHelperTemplates(source);
  return tagged
    .get('quasi')
    .get('expressions')
    .every((hole) => isEmbeddedHole(hole, helpers));
}

/** The unstable source an embedded tag, or the hook that returned it, is imported from. */
function getEmbeddedTagSource(callee: NodePath): string | undefined {
  if (!callee.isIdentifier()) return undefined;
  const binding = callee.scope.getBinding(callee.node.name);
  if (!binding || !isAfter(callee.node, binding.path.node)) return undefined;
  if (getHelperName(callee) === 't') return getNamedImport(callee)?.source;
  if (
    !binding.constant ||
    !binding.path.isVariableDeclarator() ||
    !t.isVariableDeclaration(binding.path.parent, { kind: 'const' }) ||
    !t.isIdentifier(binding.path.node.id)
  ) {
    return undefined;
  }
  let init = binding.path.get('init');
  if (init.isAwaitExpression()) init = init.get('argument');
  if (!init.isCallExpression()) return undefined;
  const hookCallee = init.get('callee');
  const hook = getHelperName(hookCallee);
  return hook === 'useGT' || hook === 'getGT'
    ? getNamedImport(hookCallee)?.source
    : undefined;
}

// The SWC plugin tracks imports and `const gt = useGT()` in source order, so it does not embed an earlier use
function isAfter(node: t.Node, declaration: t.Node): boolean {
  return (
    node.start != null &&
    declaration.end != null &&
    node.start >= declaration.end
  );
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

/** A hole the compiler embeds: a named variable, or with `helpers` a helper it reads from the call site. */
function isEmbeddedHole(hole: NodePath, helpers: boolean): boolean {
  let expression = hole;
  while (
    expression.isTSAsExpression() ||
    expression.isTSSatisfiesExpression() ||
    expression.isTSNonNullExpression() ||
    expression.isTSTypeAssertion() ||
    expression.isParenthesizedExpression()
  ) {
    expression = expression.get('expression') as NodePath<t.Expression>;
  }
  if (expression.isObjectExpression()) return isNamedVariable(expression.node);
  if (!helpers) return false;
  if (expression.isIdentifier()) return getHelperName(expression) === 'n';
  if (expression.isTaggedTemplateExpression())
    return isEmbeddedPart(expression);
  if (!expression.isCallExpression()) return false;
  const args = expression.get('arguments');
  const helper = getHelperName(expression.get('callee'));
  switch (helper) {
    case 'plural':
    case 'selectordinal':
    case 'select': {
      const [variable, branches] = args;
      return (
        args.length === 2 &&
        isNamedVariable(variable.node) &&
        branches.isObjectExpression() &&
        branches
          .get('properties')
          .every(
            (property) =>
              hasStaticKey(property.node) &&
              isEmbeddedBranch(
                (property as NodePath<t.ObjectProperty>).get('value')
              )
          )
      );
    }
    case 'number':
    case 'date':
    case 'time':
      return (
        (args.length === 1 || args.length === 2) &&
        isNamedVariable(args[0].node) &&
        (!args[1] || hasLiteralIntlOptions(args[1].node, helper))
      );
    default:
      return false;
  }
}

/** A string literal, or an inline part`...` whose holes are embedded too. */
function isEmbeddedBranch(value: NodePath): boolean {
  return (
    value.isStringLiteral() ||
    (value.isTemplateLiteral() && isStaticTemplate(value.node)) ||
    (value.isTaggedTemplateExpression() && isEmbeddedPart(value))
  );
}

function isEmbeddedPart(part: NodePath<t.TaggedTemplateExpression>): boolean {
  const quasi = part.get('quasi');
  return (
    getHelperName(part.get('tag')) === 'part' &&
    quasi.node.quasis.every((element) => element.value.cooked != null) &&
    quasi.get('expressions').every((hole) => isEmbeddedHole(hole, true))
  );
}

function isStaticTemplate(node: t.TemplateLiteral): boolean {
  return node.expressions.length === 0 && node.quasis[0].value.cooked != null;
}

/** Literal message options; formatting context, such as a currency, may be any expression. */
function hasLiteralIntlOptions(
  node: t.Node,
  kind: 'number' | 'date' | 'time'
): boolean {
  const contextKeys: readonly string[] =
    kind === 'number' ? NUMBER_CONTEXT_OPTIONS : DATE_TIME_CONTEXT_OPTIONS;
  return (
    t.isObjectExpression(node) &&
    node.properties.every((property) => {
      const key = getStaticKey(property);
      if (key === undefined) return false;
      if (contextKeys.includes(key)) return true;
      const { value } = property as t.ObjectProperty;
      return (
        getNumber(value) !== undefined ||
        t.isBooleanLiteral(value) ||
        t.isStringLiteral(value) ||
        (t.isTemplateLiteral(value) && isStaticTemplate(value))
      );
    })
  );
}

/** `${{ name }}` or `${{ name: value }}`, with TypeScript wrappers removed. */
function isNamedVariable(hole: t.Node): boolean {
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
  return (
    t.isObjectExpression(node) &&
    node.properties.length === 1 &&
    hasStaticKey(node.properties[0])
  );
}

function hasStaticKey(
  property: t.ObjectExpression['properties'][number]
): boolean {
  return getStaticKey(property) !== undefined;
}

/** A key the compilers read: an identifier, a string or a number, not computed. */
function getStaticKey(
  property: t.ObjectExpression['properties'][number]
): string | undefined {
  if (!t.isObjectProperty(property) || property.computed) return undefined;
  const { key } = property;
  const name = t.isIdentifier(key)
    ? key.name
    : t.isStringLiteral(key)
      ? key.value
      : t.isNumericLiteral(key)
        ? String(key.value)
        : undefined;
  // The compilers leave every __proto__ key to the runtime, shorthand too
  return name === '__proto__' ? undefined : name;
}
