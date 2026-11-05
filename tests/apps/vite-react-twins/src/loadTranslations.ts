export default async function loadTranslations(locale: string) {
  const translations = await import(`./_gt/${locale}.json`);
  return translations.default;
}
