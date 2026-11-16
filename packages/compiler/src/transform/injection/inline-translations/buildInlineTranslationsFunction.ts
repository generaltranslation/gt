import * as t from '@babel/types';
import type { InlineTranslationsTable } from './loadInlineTranslations';

const LOCALE_PARAM = 'locale';

/**
 * Build `(locale) => locale === "fr" ? … : locale === "es" ? … : undefined`
 * for a translation hash. Returns undefined when no embedded locale has a
 * translation for the hash.
 */
export function buildInlineTranslationsFunction(
  table: InlineTranslationsTable,
  hash: string
): t.ArrowFunctionExpression | undefined {
  const entries = Object.entries(table).flatMap(([locale, translations]) =>
    Object.prototype.hasOwnProperty.call(translations, hash) &&
    translations[hash] != null
      ? [[locale, translations[hash]] as const]
      : []
  );
  if (entries.length === 0) return undefined;

  const body = entries.reduceRight<t.Expression>(
    (alternate, [locale, translation]) =>
      t.conditionalExpression(
        t.binaryExpression(
          '===',
          t.identifier(LOCALE_PARAM),
          t.stringLiteral(locale)
        ),
        t.valueToNode(translation),
        alternate
      ),
    t.identifier('undefined')
  );

  return t.arrowFunctionExpression([t.identifier(LOCALE_PARAM)], body);
}
