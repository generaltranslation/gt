export default async function loadTranslations(locale: string) {
  const translations = await import(`./public/_gt/${locale}.json`);
  return translations.default;
}
