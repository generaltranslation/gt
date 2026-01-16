
export default async function loadTranslations(locale: string) {
  try {
    const t = await import(`../../public/_gt/${locale}.json`);
    return t.default;
  } catch (error) {
    console.warn(`Failed to load translations for locale ${locale}:`, error);
    return {};
  }
}
