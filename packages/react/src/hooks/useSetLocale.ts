import useGTContext from '../provider/GTContext';

/**
 * Sets the user's locale in the `<GTProvider>` context.
 * If the locale passed is not supported, will fallback on current locale and then defaultLocale if necessary.
 * @note Unless a locale has explicitly been passed to the `<GTProvider>`, this will override the user's browser preferences. The locale passed to `<GTProvider>` will always take priority.
 *
 * @returns {(locale: string) => void} A function that sets the user's locale.
 *
 * @example
 * setLocale('en-US');
 */
export default function useSetLocale(): (locale: string) => void {
  const { setLocale } = useGTContext(
    "setLocale(): Unable to access user's locale outside of a <GTProvider>"
  );
  return setLocale;
}
