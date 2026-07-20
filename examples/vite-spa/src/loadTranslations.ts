export default async function loadTranslations(locale: string) {
  try {
    const translations = await import(`./_gt/${locale}.json`);
    return translations.default;
  } catch {
    console.warn(`No translations found for ${locale}`);
    return {};
  }
}
