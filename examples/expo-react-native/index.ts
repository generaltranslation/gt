import { registerRootComponent } from 'expo';
import { getLocaleFromNativeStore, initializeGTSPA } from 'gt-react-native';

import gtConfig from './gt.config.json';
import { reloadRuntime } from './runtimeReload';

void bootstrap();

async function bootstrap() {
  await initializeGTSPA({
    ...gtConfig,
    locale: getLocaleFromNativeStore() ?? undefined,
    loadTranslations,
    reload: reloadRuntime,
  });

  registerRootComponent((await import('./main')).default);
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
