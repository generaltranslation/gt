import { ReadonlyConditionStore } from 'gt-i18n/internal';
import {
  isReadonlyConditionStoreInitialized,
  setReadonlyConditionStore,
} from '../condition-store/singleton-operations';
import type { SharedGTProviderProps } from './SharedGTProviderProps';
import {
  getReactI18nCache,
  InternalGTProvider,
} from '@generaltranslation/react-core/context';

/**
 * For the server side GTProvider, we don't need to synchronize translations
 * as this will happen during the loader
 *
 * TODO: find some way to enforce this is only imported on the server
 */
export function SSRGTProvider({
  defaultLocale = getReactI18nCache().getDefaultLocale(),
  locales = getReactI18nCache().getLocales(),
  customMapping = getReactI18nCache().getCustomMapping(),
  ...props
}: SharedGTProviderProps) {
  // The condition store may already be created at the module level
  if (!isReadonlyConditionStoreInitialized()) {
    const conditionStore = new ReadonlyConditionStore({
      defaultLocale,
      locales,
      customMapping,
      ...props,
    });
    setReadonlyConditionStore(conditionStore);
  }
  return <InternalGTProvider {...props} />;
}
