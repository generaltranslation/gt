/**
 * Parse an `Accept-Language` header into locale candidates ordered by descending
 * quality (q-value) per RFC 7231. Entries without an explicit `q=` default to a
 * quality of 1, and empty entries or entries with `q=0` are dropped.
 *
 * @param header - The raw Accept-Language header value.
 * @returns Locale candidates, highest quality first.
 *
 * @example
 * parseAcceptLanguage('en;q=0.5, fr;q=0.9'); // ['fr', 'en']
 * parseAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.8'); // ['fr-FR', 'fr', 'en']
 */
export function parseAcceptLanguage(header: string): string[] {
  return header
    .split(',')
    .map((entry) => {
      const [locale, ...params] = entry.trim().split(';');
      const qParam = params.find((param) => param.trim().startsWith('q='));
      const quality = qParam ? parseFloat(qParam.split('=')[1]) : 1;
      return {
        locale: locale.trim(),
        quality: Number.isNaN(quality) ? 1 : quality,
      };
    })
    .filter((entry) => entry.locale !== '' && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.locale);
}
