/**
 * `gt-react/experimental` (server): every gt-react export, with the
 * versions of the APIs that experimental locale twins (`experimental.splitting:
 * "locale-twins"`) change. Apps that use locale twins import every GT API
 * from here.
 *
 * No 'use client' directive: the build keeps the regular entry external.
 */
export * from '../index.server';
export {
  GtInternalRegisterLocaleTwin,
  GtInternalTranslateJsx,
  markNavigatingReload,
  msg,
  T,
  t,
  useGT,
  useMessages,
  applyLocaleTwinDocumentHeaders,
  createLocaleTwinDocument,
  getLocaleTwinAssetHeaders,
  getLocaleTwinDocumentHeaders,
  resolveLocaleTwinLocale,
} from './shared';
export type {
  CreateLocaleTwinDocumentOptions,
  LocaleTwinDocument,
  LocaleTwinHeaderRecord,
  LocaleTwinRequestLike,
  ResolveLocaleTwinLocaleOptions,
  SharedGTProviderProps,
} from './shared';
export { initializeGTSRA as initializeGT } from './setup/initializeGTSRA';
export { ServerGTProvider as GTProvider } from './provider/ServerGTProvider';
