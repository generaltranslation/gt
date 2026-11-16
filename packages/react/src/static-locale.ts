/**
 * Server helpers for per-locale builds made with the compiler's experimental
 * `experimentalStaticLocale` option: negotiate a request's locale and pick
 * the build for it. Framework agnostic and free of React, for Node, edge, or
 * any server handling Web or Node requests.
 */
import { I18nConfig, parseAcceptLanguage } from 'gt-i18n/internal';
import {
  defaultLocaleCookieName,
  getCookieValue,
} from 'gt-i18n/internal/cookies';
import type { CustomMapping, LocaleMatcher } from '@generaltranslation/format';

type HeaderValue = string | string[] | null | undefined;

/**
 * Request headers as a Web `Headers` object (Fetch `Request`) or a plain
 * object with lowercase names (Node `IncomingMessage`, Express `req`).
 */
export type StaticLocaleHeaders =
  | Pick<Headers, 'get'>
  | Record<string, HeaderValue>;

/**
 * A request to negotiate: anything with headers, or the raw `Cookie` and
 * `Accept-Language` header values.
 */
export type StaticLocaleRequest =
  | { headers: StaticLocaleHeaders }
  | { cookie?: HeaderValue; acceptLanguage?: HeaderValue };

export type StaticLocaleConfig = {
  /** The app's locales, as in gt.config.json. */
  locales?: string[];
  /** The default locale, as in gt.config.json. */
  defaultLocale?: string;
  /** Custom locale aliases, as in gt.config.json. */
  customMapping?: CustomMapping;
  /** The locale matching algorithm, as in gt.config.json. */
  localeMatcher?: LocaleMatcher;
  /** The locale cookie, if your app renamed it. */
  localeCookieName?: string;
  /** Ignore the Accept-Language header, as with gt-next's `ignoreBrowserLocales`. */
  ignoreBrowserLocales?: boolean;
};

/**
 * Negotiate the locale for a request the way gt-next's middleware does
 * without locale path routing: a supported locale cookie first, then the
 * `Accept-Language` header by quality, then the default locale. The result is
 * always one of the configured locales, spelled as configured.
 *
 * @example
 * const locale = negotiateLocale(request, { locales: ['fr', 'de'], defaultLocale: 'en' });
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
  const cookieLocale = getCookieValue(
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

/**
 * The directory or URL prefix of a locale's build: `<base>/<locale>`.
 * Pass a negotiated locale, which is always a configured one.
 *
 * @example
 * getStaticLocalePath('dist', 'fr'); // 'dist/fr'
 */
export function getStaticLocalePath(base: string, locale: string): string {
  return `${base.replace(/\/+$/, '')}/${locale}`;
}

function readRequestHeaders(request: StaticLocaleRequest): {
  cookie: HeaderValue;
  acceptLanguage: HeaderValue;
} {
  if (!('headers' in request)) {
    return { cookie: request.cookie, acceptLanguage: request.acceptLanguage };
  }
  const { headers } = request;
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
