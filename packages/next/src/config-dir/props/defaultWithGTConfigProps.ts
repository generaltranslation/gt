import {
  libraryDefaultLocale,
  defaultCacheUrl,
  defaultRuntimeApiUrl,
} from 'generaltranslation/internal';
import { defaultRenderSettings } from 'gt-react/internal';

const defaultWithGTConfigProps = {
  config: './gt.config.json',
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
  ignoreBrowserLocales: false,
} as const;

export default defaultWithGTConfigProps;
