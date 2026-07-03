// Ambient, request-scoped translation functions for .astro frontmatter and
// endpoints. The gt-astro middleware scopes each request's locale via
// AsyncLocalStorage, so these are safe to call anywhere in the request.
import { getTranslationsSnapshot } from '@generaltranslation/react-core/pure';
import { getLocale } from 'gt-i18n';
import type { Hash, Locale } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';

export { getGT, getMessages, getTranslations, tx } from 'gt-i18n/internal';
export {
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  getLocale,
  getRegion,
  getLocales,
  getDefaultLocale,
  getLocaleProperties,
  getVersionId,
  mFallback,
  gtFallback,
} from 'gt-i18n';

export { withGT } from './runtime';
export { getLocalizedPath } from './utils';
export type { GTLocals } from './types';

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
