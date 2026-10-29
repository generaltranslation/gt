/**
 * `gt-react/locale-twins`: serve a locale twin SPA (`files.gt.splitting:
 * 'locale-twins'`) from your own server with the locale chosen per request.
 * Framework-agnostic and edge-safe (no React, no Node built-ins).
 *
 * Web-only: gt-react-native has no equivalent (locale twins are a Vite
 * build feature).
 *
 * @example
 * const document = createLocaleTwinDocument({ html: builtIndexHtml });
 * // in a request handler, for document routes:
 * return document.respond(request);
 */
export {
  createLocaleTwinDocument,
  getLocaleTwinAssetHeaders,
  getLocaleTwinDocumentHeaders,
  resolveLocaleTwinLocale,
} from 'gt-i18n/internal/locale-twins';
export type {
  CreateLocaleTwinDocumentOptions,
  LocaleTwinDocument,
  LocaleTwinHeaderRecord,
  LocaleTwinRequestLike,
  ResolveLocaleTwinLocaleOptions,
} from 'gt-i18n/internal/locale-twins';
