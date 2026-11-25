import {
  intlCache,
  PLURAL_CATEGORY_NAMES,
  toPluralRulesNumber,
} from '@generaltranslation/icu/internal';

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
  forms: readonly string[] = PLURAL_CATEGORY_NAMES,
  locales: string[] = [defaultDefaultLocale],
  type: Intl.PluralRuleType = 'cardinal'
): string {
  return selectPluralForm(n, forms, () =>
    intlCache.get('PluralRules', locales, { type })
  );
}

/**
 * `getPluralForm` by the rules `getRules` gives, like those of a `GTIntl`,
 * which reads a locale alias as its code. It asks for them only when a branch
 * is a category.
 */
export function selectPluralForm(
  n: number | bigint,
  forms: readonly string[],
  getRules: () => Intl.PluralRules
): string {
  const exact = `=${n}`;
  if (forms.includes(exact)) return exact;
  // As in ICU, only a category branch needs the number's category, and a
  // bigint too large to have one throws.
  const categories = forms.filter(
    (form) => form !== 'other' && form[0] !== '='
  );
  if (categories.length) {
    const category = getRules().select(toPluralRulesNumber(n));
    if (categories.includes(category)) return category;
  }
  return forms.includes('other') ? 'other' : '';
}
