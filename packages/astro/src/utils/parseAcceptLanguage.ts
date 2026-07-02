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
