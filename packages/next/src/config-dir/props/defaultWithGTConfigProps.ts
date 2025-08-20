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
  experimentalSwcPluginOptions: {
    logLevel: 'warn',
    compileTimeHash: true,
    disableBuildChecks: false,
  },
} as const;

// exported separately because it's only used in production
export const defaultCacheExpiryTime = 60000;

export default defaultWithGTConfigProps;
