const translationLoaders = {
  fr: () => import('./_gt/fr.json'),
  zh: () => import('./_gt/zh.json'),
};

export default async function loadTranslations(locale: string) {
  try {
    const loader =
      translationLoaders[locale as keyof typeof translationLoaders];
    if (!loader) return {};
    const translations = await loader();
    return translations.default;
  } catch {
    return {};
  }
}
