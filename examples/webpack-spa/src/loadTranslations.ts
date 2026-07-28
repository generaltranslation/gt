// Loads a locale's translation file at runtime. The CLI writes these files to
// src/_gt when you run `npx gt translate`. Missing files fall back to the
// source language instead of throwing.
export async function loadTranslations(locale: string) {
  try {
    const translations = await import(`./_gt/${locale}.json`);
    return translations.default;
  } catch (error) {
    console.warn(`No translations found for locale "${locale}"`, error);
    return {};
  }
}
