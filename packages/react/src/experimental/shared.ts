// The locale twin versions shared by every gt-react/experimental entry point.
export {
  GtInternalRegisterLocaleTwin,
  GtInternalTranslateJsx,
  markNavigatingReload,
  msg,
  T,
  t,
  useGT,
  useMessages,
} from '@generaltranslation/react-core/internal/experimental';

// Serve a locale twin SPA from your own server with the locale chosen per
// request. Framework-agnostic: they use no React.
export {
  applyLocaleTwinDocumentHeaders,
  createLocaleTwinDocument,
  getLocaleTwinAssetHeaders,
  getLocaleTwinDocumentHeaders,
  resolveLocaleTwinLocale,
} from 'gt-i18n/internal/experimental';
export type {
  CreateLocaleTwinDocumentOptions,
  LocaleTwinDocument,
  LocaleTwinHeaderRecord,
  LocaleTwinRequestLike,
  ResolveLocaleTwinLocaleOptions,
} from 'gt-i18n/internal/experimental';
export type { SharedGTProviderProps } from './provider/GTProviderProps';
