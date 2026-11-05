/**
 * `gt-react/experimental` (browser): every gt-react export, with the
 * versions of the APIs that experimental locale twins (`experimental.splitting:
 * "locale-twins"`) change. Apps that use locale twins import every GT API
 * from here.
 *
 * No 'use client' directive: the build keeps the regular entry external.
 */
export * from '../index.client';
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
export { initializeGTSPA } from './setup/initializeGTSPA';
export type { InitializeGTSPAParams } from './setup/initializeGTSPA';
export { initializeGTSRAClient as initializeGT } from './setup/initializeGTSRA';
export { createOrUpdateBrowserConditionStore } from './condition-store/createBrowserConditionStore';
export { BrowserGTProvider as GTProvider } from './provider/BrowserGTProvider';
