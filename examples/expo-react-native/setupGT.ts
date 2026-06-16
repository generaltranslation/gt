import { getLocaleFromNativeStore, initializeGTSPA } from 'gt-react-native';

import gtConfig from './gt.config.json';

type RuntimeReload = Parameters<typeof initializeGTSPA>[0]['reload'];

export async function setupGT(reload?: RuntimeReload) {
  await initializeGTSPA({
    ...gtConfig,
    locale: getLocaleFromNativeStore() ?? undefined,
    loadTranslations,
    reload,
  });
}

async function loadTranslations(locale: string) {
  switch (locale) {
    case 'es':
      return (await import('./src/_gt/es.json')).default;
    case 'fr':
      return (await import('./src/_gt/fr.json')).default;
    default:
      return null;
  }
}
