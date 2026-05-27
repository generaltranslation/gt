import type { InternalGTProviderProps } from '@generaltranslation/react-core/context';
import type { ReadonlyConditionStoreParams } from 'gt-i18n/internal/types';

/**
 * We force the user to pass translations so they can be synchronously accessed
 *
 * - {@link InternalGTProviderProps} - requires translations and dictionaries
 * - {@link ReadonlyConditionStoreParams} - requires locale
 */
export type SharedGTProviderProps = InternalGTProviderProps &
  ReadonlyConditionStoreParams;
