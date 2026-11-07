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

  const inline = buildInlineTranslationsFunction(table, hash);
  if (inline) {
    props.properties.push(t.objectProperty(t.identifier('inline'), inline));
  }
}
