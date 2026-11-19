import type { ChunkTranslationsState, Translations } from './state';
import { getState, getTranslatedLocale } from './state';
import {
  addArrived,
  getFileUrl,
  register,
  request,
  warnMissingLocale,
} from './request';
import { isSameAssignment, readCurrentNames } from './recovery';

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

/**
 * @param isRetry Whether the file is asked for in place of one the host did not have, by the token of the build that is served now.
 */
export function requestFile(
  state: ChunkTranslationsState,
  locale: string,
  file: string,
  isRetry?: boolean
): Promise<boolean> {
  const tokens = state.v;
  const token = tokens?.[locale];
  if (!tokens || token === undefined) {
    // Kept, so the page is warned once
    return ((state.r ||= {})[locale] ||= warnMissingLocale(state, locale));
  }
  const key = `${locale} ${file}`;
  const requested = state.g?.[key];
  if (requested) state.g![key] = undefined;
  const retry = () => {
    if (tokens[locale] === token) return undefined;
    // The request that failed is in the way of this one
    state.r![key] = undefined;
    return requestFile(state, locale, file, true);
  };
  return request(
    state,
    key,
    getFileUrl(state, file, locale, token),
    requested,
    (translations: Translations) => register(state, locale, translations),
    isRetry
      ? undefined
      : () =>
          retry() ||
          // The token of the build that is served now names every file the
          // page has yet to ask for
          readCurrentNames(state, locale, (name, current) => {
            if (isSameAssignment(state, current)) tokens[locale] = name;
          }).then(retry)
  );
}
