export default async function loadTranslations(locale: string) {
  try {
    const translations = await import(`./public/_gt/${locale}.json`);
    return translations.default;
  } catch {
    return {};
  }
}
