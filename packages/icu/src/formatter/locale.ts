// Resolving a locale costs more than formatting most messages, and an app
// formats in a handful of locales; the cap bounds locales that come from input.
const resolvedLocales = new Map<string, Intl.Locale>();
const MAX_RESOLVED_LOCALES = 64;

export function resolveLocale(
  locales: string | string[]
): Intl.Locale | undefined {
  if (typeof Intl.Locale === 'undefined') return undefined;
  const key = cacheKey(locales);
  if (key === undefined) return resolveLocaleList(locales);
  let locale = resolvedLocales.get(key);
  if (!locale) {
    locale = resolveLocaleList(locales);
    if (resolvedLocales.size >= MAX_RESOLVED_LOCALES) resolvedLocales.clear();
    resolvedLocales.set(key, locale);
  }
  return locale;
}

/**
 * A locale, or a list of them, as one key: the list joined with NUL, which
 * no locale holds. A list with a hole or with something else in it is not
 * cached, so two different lists never share a key.
 */
function cacheKey(locales: string | string[]): string | undefined {
  const list = typeof locales === 'string' ? [locales] : locales;
  for (let index = 0; index < list.length; index++) {
    const locale = list[index];
    if (typeof locale !== 'string' || locale.includes('\0')) return undefined;
  }
  return list.join('\0');
}

function resolveLocaleList(locales: string | string[]): Intl.Locale {
  const supported = Intl.NumberFormat.supportedLocalesOf(locales)[0];
  const requested = typeof locales === 'string' ? locales : locales[0];
  // Preserve intl-messageformat's behavior for empty locale lists: allowing
  // Intl.Locale to reject an absent fallback avoids silently switching to the
  // host locale. Resolving the full list first also supports sparse arrays.
  return new Intl.Locale(supported ?? (requested as string));
}
