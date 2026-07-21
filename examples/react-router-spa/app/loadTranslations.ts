// Loads a locale's translation file in the browser at runtime. The path here
// must match the `files.gt.output` path in gt.config.json. The CLI generates
// these files when you run `npx gt translate`; this example ships hand-written
// fixtures so locale switching works without any API access.
export async function loadTranslations(locale: string) {
  try {
    const translations = await import(`./_gt/${locale}.json`);
    return translations.default;
  } catch (error) {
    console.warn(`No translations found for locale "${locale}"`, error);
    return {};
  }
}
