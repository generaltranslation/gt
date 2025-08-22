import { intlCache } from '../cache/IntlCache';
import { _standardizeLocale } from './isValidLocale';

/**
 * @internal
 */
export default function _isSupersetLocale(
  superLocale: string,
  subLocale: string
): boolean {
  try {
    const {
      language: languageSuper,
      region: regionSuper,
      script: scriptSuper,
    } = intlCache.get('Locale', _standardizeLocale(superLocale));
    const {
      language: languageSub,
      region: regionSub,
      script: scriptSub,
    } = intlCache.get('Locale', _standardizeLocale(subLocale));

    if (languageSuper !== languageSub) return false;
    if (regionSuper && regionSuper !== regionSub) return false;
    if (scriptSuper && scriptSuper !== scriptSub) return false;

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
