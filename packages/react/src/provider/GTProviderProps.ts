import type { InternalGTProviderProps } from '@generaltranslation/react-core/components';
import { BrowserConditionStoreParams } from '../condition-store/BrowserConditionStore';

/**
 * We force the user to pass translations so they can be synchronously accessed
 *
 * - {@link InternalGTProviderProps} - requires translations and dictionaries
 * - {@link BrowserConditionStoreParams} - requires locale
 */
export type SharedGTProviderProps = Omit<
  InternalGTProviderProps,
  | 'i18nStore'
  | 'region'
  | 'enableI18n'
  | 'setLocale'
  | 'setRegion'
  | 'setEnableI18n'
> &
  Omit<BrowserConditionStoreParams, 'locale'> & {
    locale: string;
  };
