/**
 * `gt-i18n/internal/experimental`: the experimental locale twins runtime
 * (`experimental.splitting: "locale-twins"`) for the framework packages'
 * `/experimental` entry points. Not public API.
 */

// ===== Runtime ===== //
export {
  registerLocaleTwin,
  registerLocaleTwin as GtInternalRegisterLocaleTwin,
  getLocaleTwinEntry,
  getLocaleTwinLocale,
  hasLocaleTwins,
} from './locale-twins/registry';
export {
  getLocaleTwinCacheParams,
  initializeLocaleTwins,
  isLocaleTwinsClient,
  isLocaleTwinsEnabled,
  resolveLocaleTwinLookup,
} from './locale-twins/runtime';
export type {
  LocaleTwinLookup,
  LocaleTwinLookupOptions,
} from './locale-twins/runtime';
export {
  markNavigatingReload,
  withLocaleTwinReload,
} from './locale-twins/reload';
export {
  getGTInternal,
  getMessagesInternal,
} from './locale-twins/translationFunctions';
export { msg } from './locale-twins/msg';

// ===== SPA documents ===== //
// The contract written by the build, the browser bootstrap and the edge-safe
// server helper (public from gt-react/experimental).
export { LOCALE_TWIN_BOOTSTRAP_SCRIPT } from './locale-twins/bootstrap';
export {
  createLocaleTwinDocumentMarkup,
  escapeHtmlAttribute,
  LOCALE_TWIN_BOOTSTRAP_ATTRIBUTE,
  LOCALE_TWIN_DOCUMENT_DATA_ID,
  LOCALE_TWIN_DOCUMENT_VERSION,
  parseLocaleTwinDocument,
} from './locale-twins/document';
export type {
  LocaleTwinDocumentData,
  LocaleTwinDocumentTag,
  ParsedLocaleTwinDocument,
} from './locale-twins/document';
export {
  applyLocaleTwinDocumentHeaders,
  createLocaleTwinDocument,
  getLocaleTwinAssetHeaders,
  getLocaleTwinDocumentHeaders,
  resolveLocaleTwinLocale,
} from './locale-twins/serving';
export type {
  CreateLocaleTwinDocumentOptions,
  LocaleTwinDocument,
  LocaleTwinHeaderRecord,
  LocaleTwinRequestLike,
  ResolveLocaleTwinLocaleOptions,
} from './locale-twins/serving';
