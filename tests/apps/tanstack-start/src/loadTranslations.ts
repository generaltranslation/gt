export default async function loadTranslations(locale: string) {
  try {
    const translations = await import(`./_gt/${locale}.json`);
    const result = translations.default;
    return result;
  } catch {
    return {};
  }
}
