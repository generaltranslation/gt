import useGTContext from '../provider/GTContext';

/**
 * Returns the configured GT class instance.
 *
 * @returns {GT} The configured GT class instance.
 *
 * @example
 * const gt = useGTClass();
 * console.log(gt.getLocaleProperties('en-US'));
 */
export function useGTClass() {
  return useGTContext(
    'useGTClass(): Unable to access configured GT class instance outside of a <GTProvider>'
  ).gt;
}

/**
 * Returns the locale properties for the given locale.
 *
 * @param {string} locale - The locale to get the properties for.
 * @returns {LocaleProperties} The locale properties for the given locale.
 *
 * @example
 * const localeProperties = useLocaleProperties('en-US');
 * console.log(localeProperties);
 */
export function useLocaleProperties(locale: string) {
  const gt = useGTClass();
  return gt.getLocaleProperties(locale);
}
