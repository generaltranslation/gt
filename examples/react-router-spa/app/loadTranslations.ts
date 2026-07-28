// Loads a locale's translation file in the browser; the path must match
// `files.gt.output` in gt.config.json. `npx gt translate` generates these files;
// this example ships hand-written fixtures so switching works without API access.
export async function loadTranslations(locale: string) {
  try {
    const translations = await import(`./_gt/${locale}.json`);
    return translations.default;
  } catch (error) {
    console.warn(`No translations found for locale "${locale}"`, error);
    return {};
  }
}
