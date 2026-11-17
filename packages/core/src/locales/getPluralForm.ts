import { getCachedPluralRules } from '@generaltranslation/format/internal';

import { pluralForms } from '../settings/plurals';
import { defaultDefaultLocale } from '@generaltranslation/format/internal';

/**
 * Picks a plural branch as ICU does: the exact key `=n`, then the locale's
 * plural category for `n`, then `other`.
 *
 * @param n - The number to pick a branch for.
 * @param forms - The keys of the branches there are.
 * @returns The key of the branch, or an empty string if none fit.
 */
export function getPluralForm(
  n: number | bigint,
  forms: readonly string[] = pluralForms,
  locales: string[] = [defaultDefaultLocale]
): string {
  const exact = `=${n}`;
  if (forms.includes(exact)) return exact;
  // Intl.PluralRules does not take a bigint.
  const category = getCachedPluralRules(locales).select(Number(n));
  if (forms.includes(category)) return category;
  if (forms.includes('other')) return 'other';
  return '';
}
