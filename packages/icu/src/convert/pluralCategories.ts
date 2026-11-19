import { PLURAL_CATEGORIES } from '../settings/syntax';

/**
 * The plural categories a locale uses, cardinal or ordinal, in CLDR's order.
 * Nothing when Intl has no plural rules for the locale: Intl would answer
 * with the host's language instead.
 */
export function getPluralCategories(
  locale: string,
  type: Intl.PluralRuleType
): string[] | undefined {
  if (!Intl.PluralRules.supportedLocalesOf(locale).length) return undefined;
  const used: readonly string[] = new Intl.PluralRules(locale, {
    type,
  }).resolvedOptions().pluralCategories;
  return [...PLURAL_CATEGORIES].filter((category) => used.includes(category));
}
