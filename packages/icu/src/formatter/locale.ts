// Resolving a locale costs more than formatting most messages, and an app
// formats in a handful of locales; the cap bounds locales that come from input.
const resolvedLocales = new Map<string, ResolvedLocale>();
const MAX_RESOLVED_LOCALES = 64;

/** A locale as Intl supports it, or as it was given when Intl does not. */
type ResolvedLocale = { locale: Intl.Locale; supported: boolean };

/**
 * The locale to format in: the first one Intl supports, as
 * `supportedLocalesOf` picks one from a list. Each locale is resolved once,
 * so a list is a lookup per locale and needs no key of its own.
 */
export function resolveLocale(
  locales: string | string[]
): Intl.Locale | undefined {
  if (typeof Intl.Locale === 'undefined') return undefined;
  if (typeof locales !== 'string') return firstSupported(locales);
  return (resolvedLocales.get(locales) ?? resolve(locales)).locale;
}

/**
 * Every locale of the list is looked up, so one that is not valid is an
 * error wherever it stands, as it is to Intl.
 */
function firstSupported(locales: string[]): Intl.Locale {
  let first: Intl.Locale | undefined;
  for (const locale of locales) {
    // A sparse list has holes, which Intl skips too.
    if (locale === undefined) continue;
    const resolved = resolvedLocales.get(locale) ?? resolve(locale);
    if (resolved.supported) first ??= resolved.locale;
  }
  // Preserve intl-messageformat's behavior for a list Intl supports none of:
  // its first locale, and for an empty list an error from Intl.Locale, which
  // avoids silently switching to the host locale.
  return (
    first ?? (resolvedLocales.get(locales[0]) ?? resolve(locales[0])).locale
  );
}

function resolve(locale: string): ResolvedLocale {
  const supported = Intl.NumberFormat.supportedLocalesOf(locale)[0];
  const resolved = {
    locale: new Intl.Locale(supported ?? locale),
    supported: supported !== undefined,
  };
  if (resolvedLocales.size >= MAX_RESOLVED_LOCALES) resolvedLocales.clear();
  resolvedLocales.set(locale, resolved);
  return resolved;
}
