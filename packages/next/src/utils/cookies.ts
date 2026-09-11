import { defaultLocaleCookieName } from 'gt-i18n/internal/cookies';

/**
 * Cookie name for middleware locale routing enabled flag
 */
export const defaultLocaleRoutingEnabledCookieName =
  'generaltranslation.locale-routing-enabled';

/** Locale requested for the next routed navigation, before it is rendered. */
export const defaultRoutingFetchLocaleCookieName =
  'generaltranslation.routing-fetch-locale';

/** Keep custom locale-cookie namespaces isolated across apps on one host. */
export function getRoutingFetchLocaleCookieName(
  localeCookieName: string
): string {
  return localeCookieName === defaultLocaleCookieName
    ? defaultRoutingFetchLocaleCookieName
    : `${localeCookieName}.routing-fetch`;
}

/**
 * Cookie name for tracking the referrer locale
 */
export const defaultReferrerLocaleCookieName =
  'generaltranslation.referrer-locale';

/**
 * Next.js Pages Router locale preference cookie.
 *
 * @see https://nextjs.org/docs/pages/guides/internationalization#leveraging-the-next_locale-cookie
 */
export const nextLocaleCookieName = 'NEXT_LOCALE';
