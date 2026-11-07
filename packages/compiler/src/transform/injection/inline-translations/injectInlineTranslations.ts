import * as t from '@babel/types';
import { TransformState } from '../../../state/types';
import { buildInlineTranslationsFunction } from './buildInlineTranslationsFunction';

/**
 * Append the inline translations callback as the third argument of a string
 * translation call: gt(message, options, (locale) => …).
 *
 * Expects the options argument to already be present (hash injection adds it).
 */
export function injectInlineTranslationsArgument(
  callExpr: t.CallExpression,
  hash: string | undefined,
  state: TransformState
): void {
  const table = state.settings.inlineTranslationsTable;
  if (!table || !hash || callExpr.arguments.length !== 2) return;
  if (canSpreadOverrideHash(callExpr.arguments[1])) return;

  const inline = buildInlineTranslationsFunction(table, hash);
  if (inline) callExpr.arguments.push(inline);
}

/**
 * Add the `inline` prop to a <T> jsx invocation's props object.
 */
export function injectInlineTranslationsProp(
  props: t.ObjectExpression,
  hash: string | undefined,
  state: TransformState
): void {
  const table = state.settings.inlineTranslationsTable;
  if (!table || !hash) return;
  // A spread could carry its own _hash or inline prop
  if (props.properties.some((prop) => t.isSpreadElement(prop))) return;

  const inline = buildInlineTranslationsFunction(table, hash);
  if (inline) {
    props.properties.push(t.objectProperty(t.identifier('inline'), inline));
  }
}

/**
 * Whether the hash the runtime reads could differ from the one embedded: a
 * spread after the last $_hash can replace it at runtime.
 */
function canSpreadOverrideHash(options: t.Node | undefined): boolean {
  if (!t.isObjectExpression(options)) return true;
  let spreadAfterHash = false;
  for (const prop of options.properties) {
    if (t.isSpreadElement(prop)) spreadAfterHash = true;
    else if (t.isObjectProperty(prop) && isHashKey(prop.key)) {
      spreadAfterHash = false;
    }
  }
  return spreadAfterHash;
}

function isHashKey(key: t.ObjectProperty['key']): boolean {
  return (
    (t.isIdentifier(key) && key.name === '$_hash') ||
    (t.isStringLiteral(key) && key.value === '$_hash')
  );
}
