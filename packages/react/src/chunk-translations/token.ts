import type { ChunkTranslationsState, Translations } from './state';
import { getState, getTranslatedLocale } from './state';
import {
  addArrived,
  getFileUrl,
  register,
  request,
  warnMissingLocale,
} from './request';

/**
 * Requests translation files in the current locale. For an app that loads
 * chunks itself, as from preload links its server writes: call it with the
 * chunk's keys under `imports` in the build's `gt-chunk-translations.json`,
 * and wait for it before the chunk is imported. Returns undefined when the
 * locale renders the source.
 * @param files The keys of the files.
 */
export function loadChunkTranslations(
  files: readonly string[]
): Promise<void> | undefined {
  const locale = files.length ? getTranslatedLocale() : undefined;
  if (locale === undefined) return undefined;
  const state = getState();
  return Promise.all(
    files.map((file) => requestFile(state, locale, file))
  ).then(() => addArrived(state));
}

export function requestFile(
  state: ChunkTranslationsState,
  locale: string,
  file: string
): Promise<boolean> {
  const token = state.v?.[locale];
  if (token === undefined) {
    // Kept, so the page is warned once
    return ((state.r ||= {})[locale] ||= warnMissingLocale(state, locale));
  }
  const key = `${locale} ${file}`;
  const requested = state.g?.[key];
  if (requested) state.g![key] = undefined;
  return request(
    state,
    key,
    getFileUrl(state, file, locale, token),
    requested,
    (translations: Translations) => register(state, locale, translations)
  );
}
