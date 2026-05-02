import { intlCache } from '../cache/IntlCache';
import { pluralForms, PluralType } from '../settings/plurals';
import { libraryDefaultLocale } from '../settings/settings';

/**
 * Returns the allowed plural form that best fits a number.
 *
 * @param {number} n - The number to determine the plural form for.
 * @param {PluralType[]} forms - The allowed plural forms.
 * @returns {PluralType} The determined plural form, or an empty string if none fit.
 */
export default function _getPluralForm(
  n: number,
  forms: PluralType[] = pluralForms as any,
  locales: string[] = [libraryDefaultLocale]
): PluralType | '' {
  const pluralRules = intlCache.get('PluralRules', locales);
  const provisionalBranchName = pluralRules.select(n);
  // Prefer supported aliases for exact numeric matches.
  const absN = Math.abs(n);
  if (absN === 0 && forms.includes('zero')) return 'zero';
  if (absN === 1) {
    if (forms.includes('singular')) return 'singular';
    if (forms.includes('one')) return 'one';
  }
  if (provisionalBranchName === 'one' && forms.includes('singular'))
    return 'singular';
  if (absN === 2) {
    if (forms.includes('dual')) return 'dual';
    if (forms.includes('two')) return 'two';
  }
  if (provisionalBranchName === 'two' && forms.includes('dual')) return 'dual';
  // Fall back from Intl plural categories to supported aliases.
  if (forms.includes(provisionalBranchName)) return provisionalBranchName;
  if (provisionalBranchName === 'two' && forms.includes('dual')) return 'dual';
  if (provisionalBranchName === 'two' && forms.includes('plural'))
    return 'plural';
  if (provisionalBranchName === 'two' && forms.includes('other'))
    return 'other';
  if (provisionalBranchName === 'few' && forms.includes('plural'))
    return 'plural';
  if (provisionalBranchName === 'few' && forms.includes('other'))
    return 'other';
  if (provisionalBranchName === 'many' && forms.includes('plural'))
    return 'plural';
  if (provisionalBranchName === 'many' && forms.includes('other'))
    return 'other';
  if (provisionalBranchName === 'other' && forms.includes('plural'))
    return 'plural';
  return '';
}
