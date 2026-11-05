// gtTanstackStart() uses this loader on both sides. Locale twins: only the
// server calls it (to render pages in each locale). Browsers get their strings
// from the locale twins and never load a locale, so production client builds
// drop the loader's translation chunks.
export default async function loadTranslations(locale: string) {
  if (import.meta.env.PROD && !import.meta.env.SSR) return {};
  try {
    const translations = await import(`./_gt/${locale}.json`);
    return translations.default;
  } catch {
    return {};
  }
}
