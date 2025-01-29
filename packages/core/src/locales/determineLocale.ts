import { _isValidLocale, _standardizeLocale } from './isValidLocale';
import _isSameLanguage from './isSameLanguage';
import _isSameDialect from './isSameDialect';

/**
 * Given a list of locales and a list of approved locales, sorted in preference order
 * Determines which locale is the best match among the approved locales, prioritizing exact matches and falling back to dialects of the same language
* @internal
*/
export default function _determineLocale(
    locales: string | string[], approvedLocales: string[]
): string | undefined {
    if (typeof locales === 'string')
        locales = [locales];
    locales = locales.filter(_isValidLocale);
    approvedLocales = approvedLocales.filter(_isValidLocale);
    if (!approvedLocales) return locales[0];
    for (const locale of locales) {
        if (!_isValidLocale(locale)) continue;
        const currentLocale = _standardizeLocale(locale)
        const candidates: string[] = [];
        for (const approvedLocale of approvedLocales) {
            const currentApprovedLocale = _standardizeLocale(approvedLocale);
            if (currentLocale === currentApprovedLocale) 
                return currentApprovedLocale; // instant match! return
            if (_isSameLanguage(currentLocale, currentApprovedLocale)) 
                candidates.push(currentApprovedLocale); // covers same dialect as well
        }
        if (candidates.length) 
            return candidates.find(candidate => _isSameDialect(currentLocale, candidate)) || 
                candidates[0];
    }
    return undefined;
}