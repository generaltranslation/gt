import { registerRootComponent } from 'expo';
import { createElement } from 'react';
import {
  getLocale,
  getTranslationsSnapshot,
  initializeGT,
} from 'gt-react-native';
import type { GTProviderProps } from 'gt-react-native';

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

async function registerApp() {
  const translations = await getTranslationsSnapshot(getLocale());
  const { default: App } = await import('./App');

  registerRootComponent(function Root() {
    return createElement(App, { translations });
  });
}

void registerApp();
