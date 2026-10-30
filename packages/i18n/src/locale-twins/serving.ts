/**
 * Framework-agnostic server helper for locale twin SPAs: picks the request
 * locale and serves the built document with that locale's twins, so the
 * browser needs no bootstrap. Edge-safe: no Node APIs, no file system (the
 * caller passes the built `index.html` text).
 *
 * Public as `gt-react/locale-twins`.
 */
import { LocaleConfig } from 'generaltranslation';
import type { CustomMapping } from 'generaltranslation/types';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from '../utils/cookieNames';
import { getCookieValue, parseAcceptLanguage } from '../utils/request';
import {
  escapeHtmlAttribute,
  parseLocaleTwinDocument,
  type LocaleTwinDocumentTag,
} from './document';

/** Header values as in Node's `IncomingHttpHeaders` or a plain object. */
export type LocaleTwinHeaderRecord = Record<
  string,
  string | readonly string[] | undefined
>;

/** Something that carries request headers. */
export type LocaleTwinRequestLike =
  | { headers: { get(name: string): string | null } }
  | { get(name: string): string | null }
  | LocaleTwinHeaderRecord;

export type ResolveLocaleTwinLocaleOptions = {
  defaultLocale: string;
  /** Locales with twins, including the default. */
  locales: string[];
  /** Locale cookie name (default: the canonical GT locale cookie). */
  localeCookieName?: string;
  /** Enable-i18n cookie name (default: the canonical GT enable-i18n cookie). */
  enableI18nCookieName?: string;
  customMapping?: CustomMapping;
};

/**
 * Resolves the locale of a request the way GT resolves it everywhere: the
 * locale cookie, then `Accept-Language`, then the default locale. Candidates
 * without twins are skipped. A visitor who disabled i18n (enable-i18n cookie
 * `false`) gets the default locale, whose twins carry the source text.
 */
export function resolveLocaleTwinLocale(
  request: LocaleTwinRequestLike,
  options: ResolveLocaleTwinLocaleOptions
): string {
  return createLocaleResolver(options)(request);
}

function createLocaleResolver({
  defaultLocale,
  locales,
  localeCookieName = defaultLocaleCookieName,
  enableI18nCookieName = defaultEnableI18nCookieName,
  customMapping,
}: ResolveLocaleTwinLocaleOptions): (request: LocaleTwinRequestLike) => string {
  const localeConfig = new LocaleConfig({
    defaultLocale,
    locales,
    customMapping,
  });
  return (request) => {
    const header = createHeaderReader(request);
    const cookies = header('cookie');
    if (getCookieValue(cookies, enableI18nCookieName) === 'false') {
      return defaultLocale;
    }
    const candidates: string[] = [];
    const cookieLocale = getCookieValue(cookies, localeCookieName);
    if (cookieLocale) candidates.push(cookieLocale);
    candidates.push(...parseAcceptLanguage(header('accept-language')));
    return localeConfig.determineLocale(candidates) ?? defaultLocale;
  };
}

function createHeaderReader(
  request: LocaleTwinRequestLike
): (name: string) => string | undefined {
  type HeaderGetter = { get(name: string): string | null };
  const isGetter = (value: unknown): value is HeaderGetter =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<HeaderGetter>).get === 'function';
  const headers = isGetter((request as { headers?: unknown }).headers)
    ? (request as { headers: HeaderGetter }).headers
    : request;
  if (isGetter(headers)) {
    return (name) => headers.get(name) ?? undefined;
  }
  const record = headers as LocaleTwinHeaderRecord;
  return (name) => {
    const key = Object.keys(record).find(
      (candidate) => candidate.toLowerCase() === name
    );
    const value = key === undefined ? undefined : record[key];
    if (value === undefined) return undefined;
    return typeof value === 'string'
      ? value
      : value.join(name === 'cookie' ? '; ' : ', ');
  };
}

export type CreateLocaleTwinDocumentOptions = {
  /** The built `index.html` (with the locale twin data block). */
  html: string;
  /** Locale cookie name (default: the one the build wrote into the document). */
  localeCookieName?: string;
  /**
   * Enable-i18n cookie name (default: the one the build wrote into the
   * document, else the canonical GT enable-i18n cookie).
   */
  enableI18nCookieName?: string;
  /** Custom locale mapping (default: the one the build wrote into the document). */
  customMapping?: CustomMapping;
};

export type LocaleTwinDocument = {
  defaultLocale: string;
  locales: string[];
  /** The request's locale: cookie, then `Accept-Language`, then default. */
  resolveLocale(request: LocaleTwinRequestLike): string;
  /**
   * The document for `locale` (resolved against the twinned locales):
   * `<html lang>` set, and the bootstrap replaced by that locale's entry
   * twin and modulepreloads.
   */
  render(locale: string): string;
  /**
   * A `200` HTML response for the request's locale. Document headers are
   * added without overriding `init.headers` (see
   * {@link applyLocaleTwinDocumentHeaders}).
   */
  respond(request: Request, init?: ResponseInit): Response;
};

/**
 * Prepares a built locale twin SPA document for server-side locale
 * selection. Throws a diagnostic error when `html` is not a locale twin
 * document.
 */
export function createLocaleTwinDocument({
  html,
  localeCookieName,
  enableI18nCookieName,
  customMapping: customMappingOption,
}: CreateLocaleTwinDocumentOptions): LocaleTwinDocument {
  const { data, before, between, after } = parseLocaleTwinDocument(html);
  const customMapping = customMappingOption ?? data.customMapping;
  const resolveLocale = createLocaleResolver({
    defaultLocale: data.defaultLocale,
    locales: data.locales,
    localeCookieName: localeCookieName ?? data.localeCookieName,
    enableI18nCookieName: enableI18nCookieName ?? data.enableI18nCookieName,
    customMapping,
  });
  const localeConfig = new LocaleConfig({
    defaultLocale: data.defaultLocale,
    locales: data.locales,
    customMapping,
  });
  const rendered = new Map<string, string>();

  function render(requested: string): string {
    const locale =
      localeConfig.determineLocale(requested) ?? data.defaultLocale;
    let document = rendered.get(locale);
    if (document === undefined) {
      const tags = data.tags.map((tag) => renderTag(tag, locale)).join('');
      document = setHtmlLang(before, locale) + tags + between + after;
      rendered.set(locale, document);
    }
    return document;
  }

  return {
    defaultLocale: data.defaultLocale,
    locales: data.locales,
    resolveLocale,
    render,
    respond(request, init) {
      const headers = new Headers(init?.headers);
      applyLocaleTwinDocumentHeaders(headers);
      return new Response(render(resolveLocale(request)), {
        status: 200,
        ...init,
        headers,
      });
    },
  };
}

function renderTag(tag: LocaleTwinDocumentTag, locale: string): string {
  const url = tag.urls[locale];
  if (url === undefined) return '';
  const urlAttribute = tag.tag === 'script' ? 'src' : 'href';
  const attributes = [
    ...Object.entries(tag.attributes).map(([name, value]) =>
      value === '' ? name : `${name}="${escapeHtmlAttribute(value)}"`
    ),
    `${urlAttribute}="${escapeHtmlAttribute(url)}"`,
  ].join(' ');
  return tag.tag === 'script'
    ? `<script ${attributes}></script>`
    : `<link ${attributes}>`;
}

/** Sets `lang` on the `<html>` start tag (the data block comes after it). */
function setHtmlLang(html: string, locale: string): string {
  const lang = `lang="${escapeHtmlAttribute(locale)}"`;
  return html.replace(/<html\b([^>]*)>/i, (_match, attributes: string) => {
    const langPattern = /(\s)lang\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i;
    return langPattern.test(attributes)
      ? `<html${attributes.replace(langPattern, `$1${lang}`)}>`
      : `<html ${lang}${attributes}>`;
  });
}

/**
 * Headers for a document chosen per request locale: it varies by the locale
 * cookie and `Accept-Language`, and must not be reused from a shared cache.
 */
export function getLocaleTwinDocumentHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    Vary: 'Cookie, Accept-Language',
    'Cache-Control': 'private, no-cache',
  };
}

/**
 * Adds {@link getLocaleTwinDocumentHeaders} to a document response's headers
 * without overriding the app's own: `Vary` is merged (case-insensitive), and
 * `Cache-Control` and `Content-Type` are set only when absent.
 */
export function applyLocaleTwinDocumentHeaders(headers: Headers): void {
  for (const [name, value] of Object.entries(getLocaleTwinDocumentHeaders())) {
    if (name.toLowerCase() === 'vary') {
      headers.set(name, mergeVary(headers.get(name), value));
    } else if (!headers.has(name)) {
      headers.set(name, value);
    }
  }
}

function mergeVary(current: string | null, added: string): string {
  const values = (current ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const present = new Set(values.map((value) => value.toLowerCase()));
  for (const value of added.split(',').map((item) => item.trim())) {
    if (value && !present.has(value.toLowerCase())) {
      values.push(value);
      present.add(value.toLowerCase());
    }
  }
  return values.join(', ');
}

/**
 * Headers for twins and shared build files: their names change whenever
 * their content does, so they can be cached forever.
 */
export function getLocaleTwinAssetHeaders(): Record<string, string> {
  return { 'Cache-Control': 'public, max-age=31536000, immutable' };
}
