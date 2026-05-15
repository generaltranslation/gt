import {
  getReactI18nManager,
  InternalGTProvider,
} from '@generaltranslation/react-core/context';
import type { SharedGTProviderProps } from './types';

/**
 * Client side GTProvider, this is different from server side
 * GTProvider because needs to syncrhonize any incoming
 * server-side translations
 */
export function CSRGTProvider({
  translations,
  dictionary,
  ...props
}: SharedGTProviderProps) {
  // This represents an update from server
  // TODO: if a specific translation entry changes, but not the locale, this does not trigger a re-render
  // TODO: optimize by skipping updateTranslations() if client is responsible for reloading translations
  // (eg overrideSetLocale === undefined), see getI18nStore().updateLocale() in InternalGTProvider
  getReactI18nManager().updateTranslations(translations);
  if (dictionary) {
    getReactI18nManager().updateDictionaries(dictionary);
  }
  return <InternalGTProvider {...props} />;
}
