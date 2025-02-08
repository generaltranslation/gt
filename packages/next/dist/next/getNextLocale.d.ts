/**
 * Retrieves the 'accept-language' header from the headers list.
 * If the 'next/headers' module is not available, it attempts to load it. If the
 * headers function is available, it returns the primary language from the 'accept-language'
 * header. If the headers function or 'accept-language' header is not available, returns null.
 *
 * @returns {Promise<string | null>} A promise that resolves to the primary language from the
 * 'accept-language' header, or null if not available.
 */
export declare function getNextLocale(
  defaultLocale: string | undefined,
  locales: string[]
): Promise<string>;
//# sourceMappingURL=getNextLocale.d.ts.map
