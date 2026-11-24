import type { ReactNode } from 'react';
import type { Content } from '@generaltranslation/format';
import { getReactI18nCache } from '@generaltranslation/react-core/pure';
import { getI18nConfig, type Hash } from 'gt-i18n/internal';
import { getLocale } from '../request/getLocale';
import { Client_TranslationsSeed } from '../utils/client-boundary';
import { getPageHashes } from './splitTranslations';

// The lookup of a catalog that failed to load returns the content it is given.
const FAILED_LOAD: Content = [];

export type GtSegmentProps = {
  /** The id the SWC plugin gives the page it wraps. */
  id: string;
  /** The file the SWC plugin wrapped, which the build matches to the page's entry. */
  file?: string;
  children?: ReactNode;
};

/**
 * Sends the client components of a page the translations the build placed
 * with that page instead of with the root GTProvider.
 */
export async function GtSegment({ id, children }: GtSegmentProps) {
  const hashes = getPageHashes(id);
  if (!hashes) return children;
  const locale = await getLocale();
  if (!getI18nConfig().requiresTranslation({ locale })) return children;
  const lookupTranslation =
    await getReactI18nCache().getLookupTranslation(locale);
  const translations: Record<Hash, Content> = {};
  for (const hash of hashes) {
    const translation = lookupTranslation(FAILED_LOAD, {
      $_hash: hash,
      $format: 'JSX',
    });
    if (translation !== undefined && translation !== FAILED_LOAD) {
      translations[hash] = translation;
    }
  }
  return (
    <Client_TranslationsSeed translations={{ [locale]: translations }}>
      {children}
    </Client_TranslationsSeed>
  );
}
