/**
 * `@generaltranslation/react-core/internal/experimental`: the React side of
 * the experimental locale twins feature (`experimental.splitting:
 * "locale-twins"`), for the framework packages' `/experimental` entry
 * points. Each export wraps or replaces the regular one of the same name.
 * Not public API.
 */
export { GtInternalTranslateJsx, T } from './components/T';
export { useGT } from './hooks/useGT';
export { useMessages } from './hooks/useMessages';
export { t } from './functions/t';
export { internalInitializeGTSRA } from './setup/initializeGTSRA';
export type { LocaleTwinsInitializeGTParams } from './setup/initializeGTSRA';
export {
  GtInternalRegisterLocaleTwin,
  getLocaleTwinCacheParams,
  initializeLocaleTwins,
  markNavigatingReload,
  msg,
  withLocaleTwinReload,
} from 'gt-i18n/internal/experimental';
