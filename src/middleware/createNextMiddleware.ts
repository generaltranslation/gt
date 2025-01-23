import { isValidLocale, determineLocale, standardizeLocale, isSameDialect } from "generaltranslation";
import { libraryDefaultLocale, localeCookieName, localeHeaderName } from 'generaltranslation/internal'
import { listSupportedLocales } from "@generaltranslation/supported-locales";
import { createUnsupportedLocalesWarning } from "../errors/createErrors";
import { NextResponse } from "next/server";

/**
 * Extracts the locale from the given pathname.
 * 
 * @param {string} pathname - The pathname to extract from.
 * @returns {string} The extracted locale.
 */
function extractLocale(pathname: string): string | null {
    const matches = pathname.match(/^\/([^\/]+)(?:\/|$)/);
    return matches ? matches[1] : null;
}

/**
 * Middleware factory to create a Next.js middleware for i18n routing and locale detection.
 * 
 * This middleware sets a cookie based on the locale derived from several sources 
 * such as the request pathname, referer, or 'Accept-Language' header. 
 * If locale routing is enabled, it redirects to the localized pathname and 
 * updates the locale cookie.
 * 
 * @param {Object} config - Configuration object for the middleware.
 * @param {string} [config.defaultLocale='en'] - The default locale to use if no locale is detected.
 * @param {string[]} [config.locales] - Array of supported locales. If provided, the locale will be validated against this list.
 * @param {boolean} [config.localeRouting=true] - Flag to enable or disable automatic locale-based routing.
 * @returns {function} - A middleware function that processes the request and response.
 */
export default function createNextMiddleware({
    defaultLocale = libraryDefaultLocale, 
    locales = listSupportedLocales(), 
    localeRouting = true, prefixDefaultLocale = false
}: { 
    defaultLocale?: string; locales?: string[]; localeRouting?: boolean, prefixDefaultLocale?: boolean
} 
= { 
    defaultLocale: libraryDefaultLocale, localeRouting: true, prefixDefaultLocale: false
}) {
    if (!isValidLocale(defaultLocale)) throw new Error(`gt-next middleware: defaultLocale "${defaultLocale}" is not a valid locale.`)

    const warningLocales = locales.filter(locale => !isValidLocale(locale));
    if (warningLocales.length) console.warn(createUnsupportedLocalesWarning(warningLocales))
    
    const approvedLocales = locales;

    /**
    * Processes the incoming request to determine the user's locale and sets a locale cookie.
    * Optionally redirects the user based on the locale if locale-based routing is enabled.
    * 
    * - Checks if the request URL contains a locale.
    * - Falls back to the referer URL for locale if needed.
    * - If no locale is found in the URL or referer, it checks the 'Accept-Language' header.
    * - Sets a cookie with the detected or default locale.
    * - Redirects to the correct locale route if locale routing is enabled.
    * 
    * @param {any} req - The incoming request object, containing URL and headers.
    * @returns {NextResponse} - The Next.js response, either continuing the request or redirecting to the localized URL.
    */
    function nextMiddleware(req: any) {

        const headerList = new Headers(req.headers)

        const res = NextResponse.next();

        let userLocale = standardizeLocale(defaultLocale);

        if (localeRouting) {
            
            // Check if there is any supported locale in the pathname
            const { pathname } = req.nextUrl

            const locale = extractLocale(pathname);
        
            if (locale && isValidLocale(locale)) {
                const approvedLocale = determineLocale(locale, approvedLocales);
                if (approvedLocale) {
                    userLocale = standardizeLocale(approvedLocale);
                    res.headers.set(localeHeaderName, userLocale);
                    res.cookies.set(localeCookieName, userLocale);
                    return res;
                }
            }

            // If there's no locale, try to get one from the referer
            const referer = headerList.get('referer')
            
            if (referer && typeof referer === 'string') {
                const refererLocale = extractLocale((new URL(referer))?.pathname);
                if (refererLocale) {
                    const approvedLocale = determineLocale(refererLocale, approvedLocales);
                    if (approvedLocale) {
                        userLocale = standardizeLocale(approvedLocale);
                        req.nextUrl.pathname = `/${userLocale}/${pathname}`;
                        return NextResponse.redirect(req.nextUrl);
                    };
                }
            }
        }
        
        userLocale = (() => {
            /* Removed until preloading can be accurately detected
            const cookieLocale = req.cookies.get(localeCookieName);
            if (cookieLocale?.value) {
                if (isValidLocale(cookieLocale.value))
                    return standardizeLocale(cookieLocale.value)
            }*/
            const acceptedLocales = headerList.get('accept-language')?.split(',').map(item => item.split(';')?.[0].trim())?.filter(code => isValidLocale(code));
            if (acceptedLocales && acceptedLocales.length > 0) {
                const approvedLocale = determineLocale(acceptedLocales, approvedLocales);
                if (approvedLocale) {
                    userLocale = standardizeLocale(approvedLocale);
                }
            }
            return userLocale;
        })();

        res.cookies.set(localeCookieName, userLocale);
        res.headers.set(localeHeaderName, userLocale);
        
        if (localeRouting) {
            const { pathname } = req.nextUrl;
            const originalUrl = req.nextUrl;
            // Construct new URL with original search parameters
            const newUrl = new URL(`/${userLocale}${pathname}`, originalUrl);
            newUrl.search = originalUrl.search; // keep the query parameters
            if (!prefixDefaultLocale && isSameDialect(userLocale, defaultLocale)) {
                const rewrittenRes = NextResponse.rewrite(newUrl, req.nextUrl);
                rewrittenRes.cookies.set(localeCookieName, userLocale);
                rewrittenRes.headers.set(localeHeaderName, userLocale);
                return rewrittenRes;
            } else {
                req.nextUrl.pathname = `/${userLocale}${pathname}`
                return NextResponse.redirect(newUrl);
            }
        }
        return res;
    }

    return nextMiddleware;

}