import { NextResponse } from 'next/server';
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
export default function createNextMiddleware({ defaultLocale, locales, localeRouting, prefixDefaultLocale, }?: {
    defaultLocale?: string;
    locales?: string[];
    localeRouting?: boolean;
    prefixDefaultLocale?: boolean;
}): (req: any) => NextResponse<unknown>;
//# sourceMappingURL=createNextMiddleware.d.ts.map