import type { InternalGTProviderProps } from '@generaltranslation/react-core/context';
import { BrowserConditionStoreParams } from '../condition-store/BrowserConditionStore';

/**
 * We force the user to pass translations so they can be synchronously accessed
 *
 * - {@link InternalGTProviderProps} - requires translations and dictionaries
 * - {@link BrowserConditionStoreParams} - requires locale
 */
export type SharedGTProviderProps = Omit<
  InternalGTProviderProps,
  'conditionStore' | 'i18nStore'
> &
  BrowserConditionStoreParams;
