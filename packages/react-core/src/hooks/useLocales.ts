import useGTContext from '../provider/GTContext';

/**
 * Retrieves the user's list of supported locales from the `<GTProvider>` context.
 *
 * @returns {string[]} The user's locales, e.g., ['en-US', 'fr', 'jp'].
 *
 * @example
 * const locales = useLocales();
 * console.log(locale); // ['en-US', 'fr', 'jp]
 */
export default function useLocales(): string[] {
  return useGTContext(
    'useLocales(): Unable to access configured locales outside of a <GTProvider>'
  ).locales;
}
