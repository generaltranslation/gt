import type { TranslationCatalog } from 'gt-vue';

const catalogs = import.meta.glob<TranslationCatalog>('./_gt/*.json', {
  import: 'default',
});

export async function loadTranslations(
  locale: string
): Promise<TranslationCatalog> {
  const loadCatalog = catalogs[`./_gt/${locale}.json`];
  return loadCatalog ? loadCatalog() : {};
}
