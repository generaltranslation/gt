import type { InternalGTProviderProps } from '@generaltranslation/react-core/context';
import type { LocaleCandidates } from 'gt-i18n/internal/types';

/**
 * We force the user to pass translations so they can be synchronously accessed
 *
 * - {@link InternalGTProviderProps} - requires translations and dictionaries
 * - locale - request/browser locale candidates
 */
export type SharedGTProviderProps = InternalGTProviderProps & {
  locale: LocaleCandidates;
};
