import { registerRootComponent } from 'expo';
import { initializeGT } from 'gt-react-native';

import App from './App';
import gtConfig from './gt.config.json';
import esTranslations from './src/_gt/es.json';
import frTranslations from './src/_gt/fr.json';

const localTranslations: Record<string, unknown> = {
  es: esTranslations,
  fr: frTranslations,
};

initializeGT({
  defaultLocale: gtConfig.defaultLocale,
  locales: gtConfig.locales,
  loadTranslations: async (locale: string) => localTranslations[locale] ?? {},
});

registerRootComponent(App);
