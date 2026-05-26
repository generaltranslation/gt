import {
  getReactI18nManager,
  InternalGTProvider,
} from '@generaltranslation/react-core/context';
import type { SharedGTProviderProps } from './SharedGTProviderProps';
import { createOrUpdateBrowserConditionStore } from '../condition-store/createBrowserConditionStore';

/**
 * Client side GTProvider, this is different from server side
 * GTProvider because needs to syncrhonize any incoming
 * server-side translations
 */
export function CSRGTProvider({
  defaultLocale = getReactI18nManager().getDefaultLocale(),
  locales = getReactI18nManager().getLocales(),
  customMapping = getReactI18nManager().getCustomMapping(),
  locale,
  ...props
}: SharedGTProviderProps) {
  // TODO: if a specific translation entry changes, but not the locale, this does not trigger a re-render
  // TODO: optimize by skipping updateTranslations() if client is responsible for reloading translations
  // (eg reloadLocale === undefined), see getI18nStore().updateLocale() in InternalGTProvider
  createOrUpdateBrowserConditionStore({
    defaultLocale,
    locales,
    customMapping,
    ...props,
  });

  return <InternalGTProvider {...props} />;
}
