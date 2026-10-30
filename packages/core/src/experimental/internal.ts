/**
 * `generaltranslation/internal/experimental`: cross-package internals of the
 * experimental locale twins feature (`experimental.splitting:
 * "locale-twins"`). Not public API.
 */
export {
  DEFAULT_TRANSLATION_SPLITTING,
  LOCALE_TWINS_SPLITTING,
  LOCALE_TWIN_MANIFEST_FILE,
  LOCALE_TWIN_MANIFEST_VERSION,
  LOCALE_TWIN_PLACEHOLDER_PREFIX,
  TRANSLATION_SPLITTING_STRATEGIES,
} from './locale-twins/constants';
export {
  isLocaleTwinsSplitting,
  isTranslationSplittingStrategy,
  resolveTranslationSplitting,
  resolveTranslationSplittingValue,
} from './locale-twins/splitting';
export {
  decodeLocaleTwinPlaceholder,
  encodeLocaleTwinPlaceholder,
  findLocaleTwinPlaceholders,
  isUnfilledLocaleTwinPlaceholder,
} from './locale-twins/placeholder';
export type {
  LocaleTwinEntries,
  LocaleTwinPlaceholderMatch,
} from './locale-twins/placeholder';
export {
  parseLocaleTwinTable,
  serializeLocaleTwinTable,
} from './locale-twins/table';
export type { LocaleTwinTable } from './locale-twins/table';
export { parseLocaleTwinManifest } from './locale-twins/manifest';
export type { LocaleTwinManifest } from './locale-twins/manifest';
