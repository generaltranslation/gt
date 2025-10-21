import useGTContext from '../provider/GTContext';

/**
 * Retrieves the application's default locale from the `<GTProvider>` context.
 *
 * If no default locale is passed to the `<GTProvider>`, it defaults to providing 'en'.
 *
 * @returns {string} The application's default locale, e.g., 'en-US'.
 *
 * @example
 * const locale = useDefaultLocale();
 * console.log(locale); // 'en-US'
 */
export default function useDefaultLocale(): string {
  return useGTContext(
    'useDefaultLocale(): Unable to access default locale outside of a <GTProvider>'
  ).defaultLocale;
}
