import * as t from '@babel/types';
import {
  DATE_TIME_CONTEXT_OPTIONS,
  NUMBER_CONTEXT_OPTIONS,
} from '@generaltranslation/icu/internal';
import { warnIgnoredProtoPropertySync } from '../../../../../console/index.js';
import { NonStaticMessageError, formatLocation } from './diagnostics.js';
import type { TreeContext } from './types.js';

/** Name of an object property whose key is known statically. */
function getStaticPropertyKey(property: t.ObjectProperty): string | undefined {
  const key = property.key;
  if (!property.computed && t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  if (t.isNumericLiteral(key)) return String(key.value);
  if (
    t.isTemplateLiteral(key) &&
    key.expressions.length === 0 &&
    key.quasis[0].value.cooked != null
  ) {
    return key.quasis[0].value.cooked;
  }
  return undefined;
}

/** Name of `{ name }` / `{ name: value }`: an object literal with exactly one key. */
export function getVariableName(node: t.Node | undefined): string {
  if (!t.isObjectExpression(node) || node.properties.length !== 1) {
    throw new NonStaticMessageError(
      'a variable is not an object literal with exactly one key, like ${{ name }}',
      node ?? t.nullLiteral()
    );
  }
  const [property] = node.properties;
  if (isProtoSetter(property)) {
    throw new NonStaticMessageError(
      'a variable is named by a __proto__: key, which adds no property',
      property
    );
  }
  return getPropertyKey(property);
}

export function getPropertyKey(
  property: t.ObjectExpression['properties'][number]
): string {
  const key = t.isObjectProperty(property)
    ? getStaticPropertyKey(property)
    : undefined;
  if (key === undefined) {
    throw new NonStaticMessageError(
      'an object key is not a static property name',
      property
    );
  }
  return key;
}

/**
 * `__proto__: value` sets the prototype instead of adding an own property;
 * shorthand and computed `['__proto__']` keys add one.
 */
function isProtoSetter(
  property: t.ObjectExpression['properties'][number]
): boolean {
  return (
    t.isObjectProperty(property) &&
    !property.computed &&
    !property.shorthand &&
    getStaticPropertyKey(property) === '__proto__'
  );
}

/** Skips a `__proto__:` property with a warning, as the runtime never sees it. */
export function skipProtoSetter(
  property: t.ObjectExpression['properties'][number],
  context: TreeContext
): boolean {
  if (!isProtoSetter(property)) return false;
  context.output.warnings.add(
    warnIgnoredProtoPropertySync(context.config.file, formatLocation(property))
  );
  return true;
}

function readStaticText(node: t.Node): string | undefined {
  if (t.isStringLiteral(node)) return node.value;
  if (
    t.isTemplateLiteral(node) &&
    node.expressions.length === 0 &&
    node.quasis[0].value.cooked != null
  ) {
    return node.quasis[0].value.cooked;
  }
}

export function getStaticText(node: t.Node, label: string): string {
  const text = readStaticText(node);
  if (text === undefined) {
    throw new NonStaticMessageError(`${label} is not a string literal`, node);
  }
  return text;
}

export function getNumber(node: t.Node): number | undefined {
  if (t.isNumericLiteral(node)) return node.value;
  if (
    t.isUnaryExpression(node) &&
    node.operator === '-' &&
    t.isNumericLiteral(node.argument)
  ) {
    return -node.argument.value;
  }
}

/**
 * A flat Intl options object with literal values. Formatting context is not
 * part of the tree, so it is left out and may be any expression.
 */
export function getIntlOptions(
  node: t.Node,
  kind: 'number' | 'date' | 'time',
  context: TreeContext
): Record<string, string | number | boolean> {
  if (!t.isObjectExpression(node)) {
    throw new NonStaticMessageError(
      'the Intl options are not an object literal',
      node
    );
  }
  const contextKeys: readonly string[] =
    kind === 'number' ? NUMBER_CONTEXT_OPTIONS : DATE_TIME_CONTEXT_OPTIONS;
  const entries: [string, string | number | boolean][] = [];
  for (const property of node.properties) {
    if (skipProtoSetter(property, context)) continue;
    const key = getPropertyKey(property);
    if (contextKeys.includes(key)) continue;
    const value = (property as t.ObjectProperty).value;
    const literal =
      getNumber(value) ??
      (t.isBooleanLiteral(value) ? value.value : readStaticText(value));
    if (literal === undefined) {
      throw new NonStaticMessageError(
        `the Intl option "${key}" is not a literal`,
        value,
        undefined,
        'Write it as a literal: only options that do not change the message, such as currency and timeZone, can be expressions'
      );
    }
    entries.push([key, literal]);
  }
  // fromEntries keeps a computed ['__proto__'] key as an own property.
  return Object.fromEntries(entries);
}
