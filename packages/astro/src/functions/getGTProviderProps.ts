import { getTranslationsSnapshot } from '@generaltranslation/react-core/pure';
import { getLocale } from 'gt-i18n';
import type { Hash, Locale } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';

export type GTProviderIslandProps = {
  locale: string;
  translations: Record<Locale, Record<Hash, Translation>>;
};

/**
 * Returns serializable props for a `<GTProvider>` inside a React island.
 * Astro serializes island props into the HTML payload, so the island hydrates
 * with the same locale and translations it was server-rendered with.
 *
 * @example
 * ---
 * const gtProps = await getGTProviderProps();
 * ---
 * <MyIsland client:load gt={gtProps} />
 */
export async function getGTProviderProps(): Promise<GTProviderIslandProps> {
  const locale = getLocale();
  const translations = await getTranslationsSnapshot(locale);
  return { locale, translations };
}
