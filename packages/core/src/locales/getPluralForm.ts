import { getCachedPluralRules } from '@generaltranslation/format/internal';
import { toPluralRulesNumber } from '@generaltranslation/icu/internal';

import { pluralForms } from '../settings/plurals';
import { defaultDefaultLocale } from '@generaltranslation/format/internal';

/**
 * Picks a plural branch as ICU does: the exact key `=n`, then the locale's
 * plural category for `n`, then `other`.
 *
 * @param n - The number to pick a branch for.
 * @param forms - The keys of the branches there are.
 * @param type - `ordinal` for the categories of 1st, 2nd, 3rd.
 * @returns The key of the branch, or an empty string if none fit.
 */
export function getPluralForm(
  n: number | bigint,
  forms: readonly string[] = pluralForms,
  locales: string[] = [defaultDefaultLocale],
  type: Intl.PluralRuleType = 'cardinal'
): string {
  return selectPluralForm(n, forms, getCachedPluralRules(locales, { type }));
}

/**
 * `getPluralForm` by the rules given, like those of a `GTIntl`, which reads a
 * locale alias as its code.
 */
export function selectPluralForm(
  n: number | bigint,
  forms: readonly string[],
  rules: Intl.PluralRules
): string {
  const exact = `=${n}`;
  if (forms.includes(exact)) return exact;
  // As in ICU, only a category branch needs the number's category, and a
  // bigint too large to have one throws.
  const categories = forms.filter(
    (form) => form !== 'other' && form[0] !== '='
  );
  if (categories.length) {
    const category = rules.select(toPluralRulesNumber(n));
    if (categories.includes(category)) return category;
  }
  return forms.includes('other') ? 'other' : '';
}
