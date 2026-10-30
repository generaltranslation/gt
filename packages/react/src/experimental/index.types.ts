/**
 * Declarations of `gt-react/experimental`: every gt-react export, with the
 * versions of the APIs that experimental locale twins change.
 *
 * No 'use client' directive: the build keeps the regular entry external.
 */
export * from '../index.types';
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
export { initializeGTSRA as initializeGT } from './setup/initializeGTSRA';
export { createOrUpdateBrowserConditionStore } from './condition-store/createBrowserConditionStore';
export { BrowserGTProvider as GTProvider } from './provider/BrowserGTProvider';
