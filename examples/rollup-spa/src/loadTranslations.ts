// Rollup cannot statically analyze a fully dynamic import path such as
// import(`./_gt/${locale}.json`), so each locale is listed explicitly. Every
// entry is a static import specifier, which lets Rollup code-split the locale
// files into separate chunks that load on demand.
const translationLoaders = {
  zh: () => import('./_gt/zh.json'),
  fr: () => import('./_gt/fr.json'),
  es: () => import('./_gt/es.json'),
  ja: () => import('./_gt/ja.json'),
};

export default async function loadTranslations(locale: string) {
  try {
    const loader =
      translationLoaders[locale as keyof typeof translationLoaders];
    if (!loader) {
      console.warn(`No translations found for locale "${locale}"`);
      return {};
    }
    const translations = await loader();
    return translations.default;
  } catch (error) {
    console.warn(`No translations found for locale "${locale}"`, error);
    return {};
  }
}
