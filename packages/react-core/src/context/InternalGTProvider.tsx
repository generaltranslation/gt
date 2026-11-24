import { useEffect, useMemo, type ReactNode } from 'react';
import type { I18nStore } from '../i18n-store/I18nStore';
import type { Locale, Hash } from 'gt-i18n/internal';
import type { Content } from '@generaltranslation/format';
import { getGTContext } from './context';
import type { OnMissingTranslation } from '../hooks/utils/missing-translation';

export type InternalGTProviderProps = {
  children?: ReactNode;
  // For streaming translations to server
  translations: Record<Locale, Record<Hash, Content>>;
  locale: string;
  region: string | undefined;
  enableI18n: boolean;
  setLocale: (locale: string) => void;
  setRegion: (region: string | undefined) => void;
  setEnableI18n: (enabled: boolean) => void;
  // Dev hot reload only: omitted in production, where lookups read the snapshots
  i18nStore?: I18nStore;
  // Custom override missing translation behavior for dev hot reload
  onMissingTranslation?: OnMissingTranslation;
};

// ===== Component ===== //
const GTContext = getGTContext();
/**
 * - Shared provider logic btwn client and server providers
 * - This is not userfacing, it should be wrapped in a userfacing provider with runtime-specific logic
 * - Locale and translations are required
 *
 * TODO: selectively filter to only pass new translations to client for dev hot reload
 * TODO: rename parent directory to "/provider" (separate PR)
 */
export function InternalGTProvider({
  children,
  translations,
  locale,
  region,
  enableI18n,
  setLocale,
  setRegion,
  setEnableI18n,
  ...devOnly
}: InternalGTProviderProps) {
  const devContext = useDevContext(devOnly, translations);
  const value = useMemo(
    () => ({
      translationsSnapshot: translations,
      locale,
      region,
      enableI18n,
      setLocale,
      setRegion,
      setEnableI18n,
      ...devContext,
    }),
    [
      translations,
      locale,
      region,
      enableI18n,
      setLocale,
      setRegion,
      setEnableI18n,
      devContext,
    ]
  );

  return <GTContext.Provider value={value}>{children}</GTContext.Provider>;
}

type DevContext = Pick<
  InternalGTProviderProps,
  'i18nStore' | 'onMissingTranslation'
>;

function useDevContextDev(
  { i18nStore, onMissingTranslation }: DevContext,
  translations: InternalGTProviderProps['translations']
): DevContext {
  // Update cache with data from server, do not emit events
  useEffect(() => {
    i18nStore?.updateTranslations(translations);
  }, [translations, i18nStore]);
  return useMemo(
    () => ({ i18nStore, onMissingTranslation }),
    [i18nStore, onMissingTranslation]
  );
}

const noDevContext: DevContext = {};

// Statically chosen so production bundles leave out dev hot reload.
const useDevContext: typeof useDevContextDev =
  process.env.NODE_ENV === 'production' ? () => noDevContext : useDevContextDev;
