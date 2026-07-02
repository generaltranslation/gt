import type { I18nConfig } from 'gt-i18n/internal';

/**
 * Parse an Accept-Language header into an array of locales, ordered by
 * quality (q-value) descending.
 *
 * @example
 * parseAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.8'); // ['fr-FR', 'fr', 'en']
 */
export function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((entry) => {
      const [locale, quality] = entry.trim().split(';');
      const qPart = quality?.split('=')[1];
      const q = qPart !== undefined ? parseFloat(qPart) : 1;
      return {
        locale: locale.trim(),
        quality: isNaN(q) ? 1 : q,
      };
    })
    .filter((entry) => entry.locale && entry.locale !== '*')
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.locale);
}

/**
 * Only segments shaped like BCP 47 tags are considered locale candidates, so
 * ordinary page paths (e.g. /about) never hit fuzzy locale matching.
 */
const LOCALE_SEGMENT_PATTERN = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{1,8})*$/;

export type PathLocaleMatch = {
  /** The raw first path segment. */
  segment: string;
  /** The supported locale the segment resolved to. */
  locale: string;
};

/**
 * Matches the first path segment against the configured locales (exact,
 * custom mapping, then BCP 47 resolution).
 */
export function matchPathLocale(
  pathname: string,
  i18nConfig: I18nConfig
): PathLocaleMatch | undefined {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (!segment) return undefined;

  const exact = i18nConfig
    .getLocales()
    .find((locale) => locale.toLowerCase() === segment.toLowerCase());
  if (exact) return { segment, locale: exact };

  const isCustomMapped = Object.prototype.hasOwnProperty.call(
    i18nConfig.getCustomMapping(),
    segment
  );
  if (!isCustomMapped && !LOCALE_SEGMENT_PATTERN.test(segment)) {
    return undefined;
  }

  const resolved = i18nConfig.determineSupportedLocale([segment]);
  return resolved ? { segment, locale: resolved } : undefined;
}

/**
 * Returns the pathname for the given locale: swaps the current locale prefix
 * when present, otherwise prepends the locale.
 */
export function getLocalizedPath(
  pathname: string,
  locale: string,
  locales: string[]
): string {
  const segments = pathname.split('/');
  const first = segments[1];
  if (
    first &&
    locales.some((candidate) => candidate.toLowerCase() === first.toLowerCase())
  ) {
    segments[1] = locale;
    return segments.join('/') || '/';
  }
  return `/${locale}${pathname === '/' ? '' : pathname}`;
}
