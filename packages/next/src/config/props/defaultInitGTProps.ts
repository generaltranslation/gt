import {
  libraryDefaultLocale,
  defaultCacheUrl,
  defaultRuntimeApiUrl,
} from 'generaltranslation/internal';
import { listSupportedLocales } from '@generaltranslation/supported-locales';
import { defaultRenderSettings } from 'gt-react/internal';

const defaultInitGTProps = {
  config: './gt.config.json',
  remoteCache: true,
  runtimeTranslation: true,
  runtimeUrl: defaultRuntimeApiUrl,
  cacheUrl: defaultCacheUrl,
  cacheExpiryTime: 60000,
  defaultLocale: libraryDefaultLocale,
  getLocale: async () => libraryDefaultLocale,
  locales: listSupportedLocales(),
  getMetadata: async () => ({}),
  maxConcurrentRequests: 100,
  maxBatchSize: 25,
  batchInterval: 50,
  renderSettings: defaultRenderSettings,
} as const;

export default defaultInitGTProps;
