type HeaderValue = string | string[] | null | undefined;

/**
 * Parse an Accept-Language header into locale candidates by preference.
 */
export function parseAcceptLanguage(header: HeaderValue): string[] {
  const headerValues = Array.isArray(header) ? header : [header];

  return headerValues
    .flatMap((value) => value?.split(',') ?? [])
    .map((entry, index) => {
      const [locale = '', ...parameters] = entry
        .split(';')
        .map((value) => value.trim());
      const qualityParameter = parameters.find((parameter) =>
        parameter.toLowerCase().startsWith('q=')
      );
      const quality = Number(qualityParameter?.slice(2) ?? 1);
      return { locale, quality, index };
    })
    .filter(
      ({ locale, quality }) =>
        locale !== '' && locale !== '*' && quality > 0 && quality <= 1
    )
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map(({ locale }) => locale);
}

/**
 * Read and decode a value from a Cookie header or document.cookie string.
 */
export function getCookieValue(
  cookieHeader: string | null | undefined,
  cookieName: string
): string | undefined {
  const prefix = `${cookieName}=`;
  const cookie = cookieHeader
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!cookie) return undefined;

  const value = cookie.slice(prefix.length);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
