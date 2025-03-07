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
  defaultLocale: libraryDefaultLocale,
  getLocale: async () => libraryDefaultLocale,
  locales: [] as string[],
  maxConcurrentRequests: 100,
  maxBatchSize: 25,
  batchInterval: 50,
  cacheExpiryTime: 60000,
  renderSettings: defaultRenderSettings,
  _usingPlugin: false,
} as const;

export default defaultInitGTProps;
