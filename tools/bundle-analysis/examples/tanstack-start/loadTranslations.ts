export default async function loadTranslations(locale: string) {
  const translations = await import(`./src/_gt/${locale}.json`);
  return translations.default;
}
