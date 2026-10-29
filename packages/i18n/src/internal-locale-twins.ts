// Locale twin SPA documents: the contract written by the build, the browser
// bootstrap and the edge-safe server helper (public as gt-react/locale-twins).
// Kept apart from ./internal so it stays small and free of runtime state.
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
