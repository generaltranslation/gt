/**
 * Server helper for per-locale builds made with the compiler's experimental
 * `experimentalStaticLocale` option: negotiate a request's locale, then serve
 * that locale's build. Framework agnostic and free of React, for Node, edge,
 * or any server handling Web or Node requests.
 */
import { I18nConfig, parseAcceptLanguage } from 'gt-i18n/internal';
import {
  defaultLocaleCookieName,
  getCookieValue,
} from 'gt-i18n/internal/cookies';
import type { GTConfig } from 'generaltranslation';

type HeaderValue = string | string[] | null | undefined;

/**
 * Request headers: a Web `Headers` object, or Node's `IncomingHttpHeaders`
 * (`req.headers`), whose names are lowercase.
 */
export type StaticLocaleHeaders =
  | Pick<Headers, 'get'>
  | Record<string, HeaderValue>;

/**
 * A request to negotiate: a Web `Request`, a Node `IncomingMessage` or
 * Express `req`, or the request's headers.
 */
export type StaticLocaleRequest =
  | { headers: StaticLocaleHeaders }
  | StaticLocaleHeaders;

/** The gt.config.json locale settings, and how requests carry the locale. */
export type StaticLocaleConfig = Pick<
  GTConfig,
  'locales' | 'defaultLocale' | 'customMapping' | 'localeMatcher'
> & {
  /** The locale cookie, if your app renamed it. */
  localeCookieName?: string;
  /** Ignore the Accept-Language header, as with gt-next's `ignoreBrowserLocales`. */
  ignoreBrowserLocales?: boolean;
};

/**
 * Negotiate the locale for a request the way gt-next's middleware does
 * without locale path routing: a supported locale cookie first (the last one
 * when the name repeats), then the `Accept-Language` header by quality, then
 * the default locale. The result is always one of the configured locales,
 * spelled as configured, so it names the per-locale build to serve.
 *
 * @example
 * const locale = negotiateLocale(request, { locales: ['fr', 'de'], defaultLocale: 'en' });
 * // With a Node request, pass it or its headers: negotiateLocale(req.headers, config)
 */
export function negotiateLocale(
  request: StaticLocaleRequest,
  {
    locales,
    defaultLocale,
    customMapping,
    localeMatcher,
    localeCookieName = defaultLocaleCookieName,
    ignoreBrowserLocales = false,
  }: StaticLocaleConfig = {}
): string {
  const i18nConfig = new I18nConfig({
    locales,
    defaultLocale,
    customMapping,
    localeMatcher,
  });
  const { cookie, acceptLanguage } = readRequestHeaders(request);

  const candidates: string[] = [];
  const cookieLocale = getLastCookieValue(
    joinCookieHeader(cookie),
    localeCookieName
  );
  if (cookieLocale && i18nConfig.isValidLocale(cookieLocale)) {
    candidates.push(cookieLocale);
  }
  if (!ignoreBrowserLocales) {
    candidates.push(...parseAcceptLanguage(acceptLanguage));
  }
  return i18nConfig.resolveSupportedLocale(candidates);
}

function readRequestHeaders(request: StaticLocaleRequest): {
  cookie: HeaderValue;
  acceptLanguage: HeaderValue;
} {
  const headers =
    'headers' in request &&
    typeof request.headers === 'object' &&
    request.headers !== null
      ? (request.headers as StaticLocaleHeaders)
      : (request as StaticLocaleHeaders);
  if (typeof headers.get === 'function') {
    const webHeaders = headers as Pick<Headers, 'get'>;
    return {
      cookie: webHeaders.get('cookie'),
      acceptLanguage: webHeaders.get('accept-language'),
    };
  }
  const nodeHeaders = headers as Record<string, HeaderValue>;
  return {
    cookie: nodeHeaders.cookie,
    acceptLanguage: nodeHeaders['accept-language'],
  };
}

function joinCookieHeader(value: HeaderValue): string | undefined {
  return (Array.isArray(value) ? value.join('; ') : value) ?? undefined;
}

// gt-next's middleware reads cookies through Next.js, which keeps the last of a repeated name
function getLastCookieValue(
  cookieHeader: string | undefined,
  cookieName: string
): string | undefined {
  const prefix = `${cookieName}=`;
  const lastCookie = cookieHeader
    ?.split(';')
    .map((value) => value.trim())
    .filter((value) => value.startsWith(prefix))
    .pop();
  return getCookieValue(lastCookie, cookieName);
}
