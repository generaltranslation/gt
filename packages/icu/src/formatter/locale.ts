export function resolveLocale(
  locales: string | string[]
): Intl.Locale | undefined {
  if (typeof Intl.Locale === 'undefined') return undefined;
  const supported = Intl.NumberFormat.supportedLocalesOf(locales)[0];
  const requested = typeof locales === 'string' ? locales : locales[0];
  // Preserve intl-messageformat's behavior for empty locale lists: allowing
  // Intl.Locale to reject an absent fallback avoids silently switching to the
  // host locale. Resolving the full list first also supports sparse arrays.
  return new Intl.Locale(supported ?? (requested as string));
}
