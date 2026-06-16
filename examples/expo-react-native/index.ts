import { registerRootComponent } from 'expo';
import { createElement, useSyncExternalStore, type ComponentType } from 'react';
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

type AppComponent = ComponentType<{
  translations: GTProviderProps['translations'];
}>;

type AppSnapshot = {
  App: AppComponent;
  translations: GTProviderProps['translations'];
};

let appSnapshot: AppSnapshot | null = null;
const listeners = new Set<() => void>();

initializeGT({
  defaultLocale: gtConfig.defaultLocale,
  locales: gtConfig.locales,
  loadTranslations: async (locale: string) => localTranslations[locale] ?? {},
});

async function loadApp() {
  const translations = await getTranslationsSnapshot(getLocale());
  const { default: App } = await import('./App');
  appSnapshot = { App, translations };
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AppSnapshot | null {
  return appSnapshot;
}

function Root() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!snapshot) return null;
  return createElement(snapshot.App, { translations: snapshot.translations });
}

void loadApp();
registerRootComponent(Root);
