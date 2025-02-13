import { PluralType } from '../settings/plurals';
/**
 * Given a number and a list of allowed plural forms, return the plural form that best fits the number.
 *
 * @param {number} n - The number to determine the plural form for.
 * @param {locales[]} forms - The allowed plural forms.
 * @returns {PluralType} The determined plural form, or an empty string if none fit.
 */
export default function _getPluralForm(n: number, forms?: PluralType[], locales?: string[]): PluralType | '';
