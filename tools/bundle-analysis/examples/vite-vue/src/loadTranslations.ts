import type { LoadTranslations } from 'gt-vue';

const loadTranslations: LoadTranslations = async (locale) => {
  try {
    return (await import(`./_gt/${locale}.json`)).default;
  } catch {
    return {};
  }
};

export default loadTranslations;
