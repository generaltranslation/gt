import useGTContext from "../provider/GTContext";

/**
 * Retrieves the user's locale from the `<GTProvider>` context.
 *
 * @returns {string} The user's locale, e.g., 'en-US'.
 *
 * @example
 * const locale = useLocale();
 * console.log(locale); // 'en-US'
 */
export default function useLocale(): string {
  return useGTContext(
    "useLocale(): Unable to access user's locale outside of a <GTProvider>"
  ).locale;
}
