import { isValidLanguageCode, determineLanguage, standardizeLanguageCode } from "generaltranslation";
import { NextResponse } from "next/server";
import { primitives } from 'gt-react/internal'
import { ResponseCookies, RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";

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
 * Copy cookies from the Set-Cookie header of the response to the Cookie header of the request,
 * so that it will appear to SSR/RSC as if the user already has the new cookies.
 * via 
 */
function applyNewCookies(req: any, res: any) {

    // 1. Parse Set-Cookie header from the response
    const setCookies = new ResponseCookies(res.headers);
  
    // 2. Construct updated Cookie header for the request
    const newReqHeaders = new Headers(req.headers);
    const newReqCookies = new RequestCookies(newReqHeaders);
    setCookies.getAll().forEach((cookie: any) => newReqCookies.set(cookie));
  
    // 3. Set up the “request header overrides” (see https://github.com/vercel/next.js/pull/41380)
    //    on a dummy response
    // NextResponse.next will set x-middleware-override-headers / x-middleware-request-* headers
    const dummyRes = NextResponse.next({ request: { headers: newReqHeaders } });
  
    // 4. Copy the “request header overrides” headers from our dummy response to the real response
    dummyRes.headers.forEach((value: any, key: any) => {
      if (key === 'x-middleware-override-headers' || key.startsWith('x-middleware-request-')) {
        res.headers.set(key, value);
      }
    });
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
    defaultLocale = primitives.libraryDefaultLocale, locales, localeRouting = true
}: { defaultLocale: string; locales?: string[]; localeRouting?: boolean } 
= { defaultLocale: primitives.libraryDefaultLocale, localeRouting: true }) {

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

        let userLocale = standardizeLanguageCode(defaultLocale);

        if (localeRouting) {
            
            // Check if there is any supported locale in the pathname
            const { pathname } = req.nextUrl

            const locale = extractLocale(pathname);

            let pathnameHasLocale: boolean = false;
        
            if (locale && isValidLanguageCode(locale)) {
                if (locales) {
                    const approvedLocale = determineLanguage(locale, locales);
                    if (approvedLocale) {
                        userLocale = standardizeLanguageCode(approvedLocale);
                        pathnameHasLocale = true;
                    }
                } else {
                    userLocale = standardizeLanguageCode(locale);
                    pathnameHasLocale = true;
                }
            }

            if (pathnameHasLocale) {
                res.cookies.set(primitives.localeCookieName, userLocale)
                applyNewCookies(req, res);
                return res;
            }

            // If there's no locale, try to get one from the referer
            const referer = headerList.get('referer')

            if (referer && typeof referer === 'string') {
                const refererLocale = extractLocale((new URL(referer))?.pathname);
                if (refererLocale) {
                    let refererLocaleIsValid = false;
                    if (locales) {
                        const approvedLocale = determineLanguage(refererLocale, locales);
                        if (approvedLocale) {
                            userLocale = standardizeLanguageCode(approvedLocale);
                            refererLocaleIsValid = true;
                        }
                    } else {
                        if (isValidLanguageCode(refererLocale)) {
                            userLocale = standardizeLanguageCode(refererLocale);
                            refererLocaleIsValid = true;
                        }
                    }
                    if (refererLocaleIsValid) {
                        req.nextUrl.pathname = `/${userLocale}/${pathname}`
                        applyNewCookies(req, res);
                        return NextResponse.redirect(req.nextUrl)
                    }
                }
            }

        }
        
        const acceptedLocales = headerList.get('accept-language')?.split(',').map(item => item.split(';')?.[0].trim())?.filter(code => isValidLanguageCode(code));
        
        if (acceptedLocales && acceptedLocales.length > 0) {
            if (locales) {
                const approvedLocale = determineLanguage(acceptedLocales, locales);
                if (approvedLocale) {
                    userLocale = standardizeLanguageCode(approvedLocale);
                }
            }
            else {
                userLocale = standardizeLanguageCode(acceptedLocales[0])
            }
        }

        res.cookies.set(primitives.localeCookieName, userLocale)

        if (localeRouting) {

            const { pathname } = req.nextUrl

            if (userLocale === defaultLocale) {
                const rewrittenRes = NextResponse.rewrite(
                    new URL(`/${userLocale}${pathname}`, req.nextUrl), req.nextUrl
                );
                rewrittenRes.cookies.set(primitives.localeCookieName, userLocale)
                applyNewCookies(req, rewrittenRes);
                return rewrittenRes;
            } else {
                req.nextUrl.pathname = `/${userLocale}${pathname}`
                applyNewCookies(req, res);
                return NextResponse.redirect(req.nextUrl)
            }
        }

        applyNewCookies(req, res);
        return res;

    }

    return nextMiddleware;

}