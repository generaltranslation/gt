import { NextRequest, NextResponse } from 'next/server';
type PathConfig = {
    [key: string]: string | {
        [key: string]: string;
    };
};
/**
 * Middleware factory to create a Next.js middleware for i18n routing and locale detection.
 *
 * This middleware sets a cookie based on the locale derived from several sources
 * such as the request pathname, referer, or 'Accept-Language' header.
 * If locale routing is enabled, it redirects to the localized pathname and
 * updates the locale cookie.
 *
 * @param {boolean} [config.localeRouting=true] - Flag to enable or disable automatic locale-based routing.
 * @param {boolean} [config.prefixDefaultLocale=false] - Flag to enable or disable prefixing the default locale to the pathname, i.e., /en/about -> /about
 * @returns {function} - A middleware function that processes the request and response.
 */
export default function createNextMiddleware({ localeRouting, prefixDefaultLocale, pathConfig, }: {
    localeRouting?: boolean;
    prefixDefaultLocale?: boolean;
    pathConfig?: PathConfig;
}): (req: NextRequest) => NextResponse<unknown>;
export {};
//# sourceMappingURL=createNextMiddleware.d.ts.map