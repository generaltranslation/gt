import { headers } from "next/headers";
import { cookies } from "next/headers";
import { primitives } from 'gt-react/internal'
import { determineLanguage } from "generaltranslation";

/**
 * Retrieves the 'accept-language' header from the headers list.
 * If the 'next/headers' module is not available, it attempts to load it. If the
 * headers function is available, it returns the primary language from the 'accept-language'
 * header. If the headers function or 'accept-language' header is not available, returns null.
 *
 * @returns {Promise<string | null>} A promise that resolves to the primary language from the
 * 'accept-language' header, or null if not available.
 */
export async function getNextLocale(defaultLocale: string = '', locales?: string[] | undefined): Promise<string> {
    const cookieStore = await cookies();
    const localeCookie = cookieStore.get(primitives.localeCookieName);
    if (localeCookie?.value) return localeCookie.value;
    const headersList = await headers();
    const acceptedLocales = headersList.get('accept-language')?.split(',').map(item => item.split(';')?.[0].trim());
    if (acceptedLocales && acceptedLocales.length) {
        if (locales) {
            return determineLanguage(acceptedLocales, locales) || defaultLocale;
        }
        return acceptedLocales[0]
    }
    return defaultLocale;
}