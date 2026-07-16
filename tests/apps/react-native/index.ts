import { registerRootComponent } from 'expo';
import { initializeGT } from 'gt-react-native';

import App from './App';
import gtConfig from './gt.config.json';
import frTranslations from './src/_gt/fr.json';
import zhTranslations from './src/_gt/zh.json';

const localTranslations: Record<string, unknown> = {
  fr: frTranslations,
  zh: zhTranslations,
};

initializeGT({
  defaultLocale: gtConfig.defaultLocale,
  locales: gtConfig.locales,
  loadTranslations: async (locale: string) => localTranslations[locale] ?? {},
});

registerRootComponent(App);
