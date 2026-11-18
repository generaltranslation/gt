import * as t from '@babel/types';
import { TransformState } from '../../../state/types';
import { buildInlineTranslationsFunction } from './buildInlineTranslationsFunction';
import {
  getInlineTranslationsModuleImportName,
  isInlineTranslationsModuleHash,
} from './inlineTranslationsModules';

/**
 * Add the `inline` prop to a <T> jsx invocation's props object.
 */
export function injectInlineTranslationsProp(
  props: t.ObjectExpression,
  hash: string | undefined,
  state: TransformState
): void {
  if (!state.settings.inlineTranslationsTable || !hash) return;
  // A spread or computed key could carry its own _hash or inline prop
  if (
    props.properties.some(
      (prop) =>
        t.isSpreadElement(prop) ||
        (prop.computed && !t.isStringLiteral(prop.key))
    )
  ) {
    return;
  }

  const inline = buildInlineTranslations(hash, state);
  if (inline) {
    props.properties.push(t.objectProperty(t.identifier('inline'), inline));
  }
}

/**
 * The inline translations callback for a hash, or with message modules a
 * reference to its module's default import, which is recorded in
 * `state.inlineTranslationsImports`. Undefined when no embedded locale
 * translates the hash.
 */
export function buildInlineTranslations(
  hash: string,
  state: TransformState
): t.Expression | undefined {
  const table = state.settings.inlineTranslationsTable;
  if (!table) return undefined;
  const inline = buildInlineTranslationsFunction(table, hash);
  if (
    !inline ||
    !state.inlineTranslationsImports ||
    !isInlineTranslationsModuleHash(hash)
  ) {
    return inline;
  }
  const name = getInlineTranslationsModuleImportName(hash);
  state.inlineTranslationsImports.set(hash, name);
  return t.identifier(name);
}
