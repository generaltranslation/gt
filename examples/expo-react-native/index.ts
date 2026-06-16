import { registerRootComponent } from 'expo';
import { initializeGT } from 'gt-react-native';
import type { GTProviderProps } from 'gt-react-native';

import App from './App';
import gtConfig from './gt.config.json';
import esTranslations from './src/_gt/es.json';
import frTranslations from './src/_gt/fr.json';

const localTranslations = {
  es: esTranslations,
  fr: frTranslations,
} as GTProviderProps['translations'];

initializeGT({
  defaultLocale: gtConfig.defaultLocale,
  locales: gtConfig.locales,
  loadTranslations: async (locale: string) => localTranslations[locale] ?? {},
});

registerRootComponent(App);
