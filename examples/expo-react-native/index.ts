import { registerRootComponent } from 'expo';
import { createElement, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  getLocale,
  getTranslationsSnapshot,
  initializeGT,
} from 'gt-react-native';
import type { GTProviderProps } from 'gt-react-native';

import App from './App';
import gtConfig from './gt.config.json';
import esTranslations from './src/_gt/es.json';
import frTranslations from './src/_gt/fr.json';

const localTranslations = {
  es: esTranslations,
  fr: frTranslations,
} as GTProviderProps['translations'];

type AppSnapshot = {
  locale: string;
  translations: GTProviderProps['translations'];
};

type RootState = {
  locale: string;
  snapshot: AppSnapshot | null;
};

const listeners = new Set<() => void>();

initializeGT({
  defaultLocale: gtConfig.defaultLocale,
  locales: gtConfig.locales,
  loadTranslations: async (locale: string) => localTranslations[locale] ?? {},
});

let rootState: RootState = {
  locale: getLocale(),
  snapshot: null,
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RootState {
  return rootState;
}

function updateRootState(nextState: RootState): void {
  rootState = nextState;
  listeners.forEach((listener) => {
    listener();
  });
}

async function loadSnapshot(locale: string): Promise<void> {
  updateRootState({ locale, snapshot: null });
  const translations = await getTranslationsSnapshot(locale);
  if (rootState.locale !== locale) return;
  updateRootState({ locale, snapshot: { locale, translations } });
}

function setLocale(locale: string): void {
  if (locale === rootState.locale && rootState.snapshot) return;
  void loadSnapshot(locale);
}

function Root() {
  const { locale, snapshot } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );

  if (!snapshot) {
    return createElement(LoadingState);
  }

  return createElement(App, {
    locale,
    translations: snapshot.translations,
    onLocaleChange: setLocale,
  });
}

void loadSnapshot(rootState.locale);
registerRootComponent(Root);

function LoadingState() {
  return createElement(
    View,
    { style: styles.loadingContainer },
    createElement(
      Text,
      { style: styles.loadingText },
      'Loading translations...'
    )
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f7f7f2',
  },
  loadingText: {
    fontSize: 16,
    color: '#374151',
  },
});
