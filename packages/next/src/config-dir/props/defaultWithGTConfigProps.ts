import {
  libraryDefaultLocale,
  defaultCacheUrl,
  defaultRuntimeApiUrl,
} from 'generaltranslation/internal';
import {
  defaultLocaleCookieName,
  defaultRenderSettings,
} from 'gt-react/internal';
import { defaultLocaleHeaderName } from '../../utils/headers';
import {
  defaultLocaleRoutingEnabledCookieName,
  defaultReferrerLocaleCookieName,
  defaultResetLocaleCookieName,
} from '../../utils/cookies';

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
  headersAndCookies: {
    localeHeaderName: defaultLocaleHeaderName,
    localeCookieName: defaultLocaleCookieName,
    referrerLocaleCookieName: defaultReferrerLocaleCookieName,
    localeRoutingEnabledCookieName: defaultLocaleRoutingEnabledCookieName,
    resetLocaleCookieName: defaultResetLocaleCookieName,
  },
  swcPluginOptions: {
    dynamicJsxCheckLogLevel: 'warn',
    dynamicStringCheckLogLevel: 'warn',
    experimentalCompileTimeHash: false,
  },
} as const;

export default defaultWithGTConfigProps;
