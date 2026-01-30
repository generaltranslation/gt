export const LOCALE_PLACEHOLDER = '{locale}';

/**
 * Checks if a URL is an external/absolute URL
 */
export function isExternalUrl(href: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(href);
}

/**
 * Processes the href to include the locale
 *
 * - If href contains {locale} placeholder, replaces it with the locale value
 * - If href is an internal path without placeholder, prepends the locale (unless hideDefaultLocale applies)
 * - If href is an external URL without placeholder, returns unchanged
 */
export function processHref(
  href: string,
  locale: string,
  defaultLocale: string,
  hideDefaultLocale: boolean
): string {
  // If href contains {locale} placeholder, replace it
  if (href.includes(LOCALE_PLACEHOLDER)) {
    return href.replace(new RegExp(LOCALE_PLACEHOLDER, 'g'), locale);
  }

  // External URLs without placeholder pass through unchanged
  if (isExternalUrl(href)) {
    return href;
  }

  // Internal paths: prepend locale (unless hiding default locale)
  const shouldHideLocale = hideDefaultLocale && locale === defaultLocale;

  if (shouldHideLocale) {
    return href;
  }

  // Ensure href starts with /
  const normalizedHref = href.startsWith('/') ? href : `/${href}`;
  return `/${locale}${normalizedHref}`;
}
