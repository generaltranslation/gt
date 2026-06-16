import { registerRootComponent } from 'expo';
import { createElement, Suspense, use } from 'react';
import { getLocaleFromNativeStore, initializeGTSPA } from 'gt-react-native';
import type { ComponentType } from 'react';

import gtConfig from './gt.config.json';
import { reloadRuntime } from './runtimeReload';

const main = bootstrap();

async function bootstrap() {
  await initializeGTSPA({
    defaultLocale: gtConfig.defaultLocale,
    locales: gtConfig.locales,
    locale: getLocaleFromNativeStore() ?? undefined,
    loadTranslations,
    reload: reloadRuntime,
  });

  return (await import('./main')).default;
}

function Bootstrap() {
  return createElement(Suspense, { fallback: null }, createElement(LoadedApp));
}

function LoadedApp() {
  const Main = use(main) as ComponentType;
  return createElement(Main);
}

registerRootComponent(Bootstrap);

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
