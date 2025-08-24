import { intlCache } from '../cache/IntlCache';
import { pluralForms, PluralType } from '../settings/plurals';
import { libraryDefaultLocale } from '../settings/settings';

/**
 * Given a number and a list of allowed plural forms, return the plural form that best fits the number.
 *
 * @param {number} n - The number to determine the plural form for.
 * @param {locales[]} forms - The allowed plural forms.
 * @returns {PluralType} The determined plural form, or an empty string if none fit.
 */
export default function _getPluralForm(
  n: number,
  forms: PluralType[] = pluralForms as any,
  locales: string[] = [libraryDefaultLocale]
): PluralType | '' {
  const pluralRules = intlCache.get('PluralRules', locales);
  const provisionalBranchName = pluralRules.select(n);
  // aliases
  const absN = Math.abs(n);
  // 0
  if (absN === 0 && forms.includes('zero')) return 'zero'; // override
  // 1
  if (absN === 1) {
    if (forms.includes('singular')) return 'singular'; // override
    if (forms.includes('one')) return 'one'; // override
  }
  if (provisionalBranchName === 'one' && forms.includes('singular'))
    return 'singular';
  // 2
  if (absN === 2) {
    if (forms.includes('dual')) return 'dual'; // override
    if (forms.includes('two')) return 'two'; // override
  }
  if (provisionalBranchName === 'two' && forms.includes('dual')) return 'dual';
  // fallbacks
  if (forms.includes(provisionalBranchName)) return provisionalBranchName;
  // two
  if (provisionalBranchName === 'two' && forms.includes('dual')) return 'dual';
  if (provisionalBranchName === 'two' && forms.includes('plural'))
    return 'plural';
  if (provisionalBranchName === 'two' && forms.includes('other'))
    return 'other';
  // few
  if (provisionalBranchName === 'few' && forms.includes('plural'))
    return 'plural';
  if (provisionalBranchName === 'few' && forms.includes('other'))
    return 'other';
  // many
  if (provisionalBranchName === 'many' && forms.includes('plural'))
    return 'plural';
  if (provisionalBranchName === 'many' && forms.includes('other'))
    return 'other';
  // other
  if (provisionalBranchName === 'other' && forms.includes('plural'))
    return 'plural';
  return '';
}
