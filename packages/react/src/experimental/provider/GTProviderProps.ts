import type { SharedGTProviderProps as RegularSharedGTProviderProps } from '../../provider/GTProviderProps';

/**
 * GTProvider props with locale twins: `translations` is optional. The server
 * loads whole locales and the browser reads its twins, so there is no
 * translations snapshot to pass.
 */
export type SharedGTProviderProps = Omit<
  RegularSharedGTProviderProps,
  'translations'
> & {
  translations?: RegularSharedGTProviderProps['translations'];
};

/** The snapshot a locale twin provider passes on when it was given none. */
export const NO_TRANSLATIONS: RegularSharedGTProviderProps['translations'] = {};
