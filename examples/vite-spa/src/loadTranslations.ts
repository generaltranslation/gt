export default async function loadTranslations(locale: string) {
  try {
    const translations = await import(`./_gt/${locale}.json`);
    return translations.default;
  } catch (error) {
    console.warn(`No translations found for locale "${locale}"`, error);
    return {};
  }
}
