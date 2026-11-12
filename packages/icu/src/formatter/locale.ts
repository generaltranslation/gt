// Resolving a locale costs more than formatting most messages, and an app
// formats in a handful of locales; the cap bounds locales that come from input.
const resolvedLocales = new Map<string, Intl.Locale>();
const MAX_RESOLVED_LOCALES = 64;

export function resolveLocale(
  locales: string | string[]
): Intl.Locale | undefined {
  if (typeof Intl.Locale === 'undefined') return undefined;
  if (typeof locales !== 'string') return resolveLocaleList(locales);
  let locale = resolvedLocales.get(locales);
  if (!locale) {
    locale = resolveLocaleList(locales);
    if (resolvedLocales.size >= MAX_RESOLVED_LOCALES) resolvedLocales.clear();
    resolvedLocales.set(locales, locale);
  }
  return locale;
}

function resolveLocaleList(locales: string | string[]): Intl.Locale {
  const supported = Intl.NumberFormat.supportedLocalesOf(locales)[0];
  const requested = typeof locales === 'string' ? locales : locales[0];
  // Preserve intl-messageformat's behavior for empty locale lists: allowing
  // Intl.Locale to reject an absent fallback avoids silently switching to the
  // host locale. Resolving the full list first also supports sparse arrays.
  return new Intl.Locale(supported ?? (requested as string));
}
