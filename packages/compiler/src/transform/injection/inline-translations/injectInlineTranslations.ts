import * as t from '@babel/types';
import { TransformState } from '../../../state/types';
import { buildInlineTranslationsFunction } from './buildInlineTranslationsFunction';

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
