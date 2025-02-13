import {
  libraryDefaultLocale,
  defaultCacheUrl,
  defaultRuntimeApiUrl,
} from 'generaltranslation/internal';
import { defaultRenderSettings } from 'gt-react/internal';

const defaultInitGTProps = {
  config: './gt.config.json',
  runtimeTranslation: true,
  loadTranslationType: 'remote',
  runtimeUrl: defaultRuntimeApiUrl,
  cacheUrl: defaultCacheUrl,
  cacheExpiryTime: 60000,
  defaultLocale: libraryDefaultLocale,
  getLocale: async () => libraryDefaultLocale,
  locales: [] as string[],
  getMetadata: async () => ({}),
  maxConcurrentRequests: 100,
  maxBatchSize: 25,
  batchInterval: 50,
  renderSettings: defaultRenderSettings,
  _usingPlugin: false,
} as const;

export default defaultInitGTProps;
