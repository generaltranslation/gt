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
  const entries = Object.entries(table).flatMap(([locale, translations]) => {
    const translation = getTranslation(translations, hash);
    return translation != null ? [[locale, translation] as const] : [];
  });
  return buildLocaleSwitch(entries);
}

function getTranslation(
  translations: Record<string, unknown>,
  hash: string
): unknown {
  if (!Object.prototype.hasOwnProperty.call(translations, hash)) {
    return undefined;
  }
  return translations[hash] ?? undefined;
}

function buildLocaleSwitch(
  entries: ReadonlyArray<readonly [string, unknown]>
): t.ArrowFunctionExpression | undefined {
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
