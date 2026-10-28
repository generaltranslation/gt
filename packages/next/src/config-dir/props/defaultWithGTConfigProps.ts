import {
  libraryDefaultLocale,
  defaultCacheUrl,
  defaultRuntimeApiUrl,
} from 'generaltranslation/internal';
import {
  defaultLocaleCookieName,
  defaultEnableI18nCookieName,
  defaultResetLocaleCookieName,
  getDefaultRenderSettings,
  type RenderMethod,
} from '@generaltranslation/react-core/pure';
import { defaultLocaleHeaderName } from '../../utils/headers';
import {
  defaultLocaleRoutingEnabledCookieName,
  defaultReferrerLocaleCookieName,
} from '../../utils/cookies';
import type { CompilerOptions } from './withGTConfigProps';

type DefaultGTConfigProps = {
  runtimeUrl: string;
  cacheUrl: string;
  defaultLocale: string;
  getLocale: () => Promise<string>;
  locales: string[];
  maxConcurrentRequests: number;
  maxBatchSize: number;
  batchInterval: number;
  renderSettings: {
    method: RenderMethod;
    timeout: number;
  };
  _usingPlugin: boolean;
  ignoreBrowserLocales: boolean;
  headersAndCookies: {
    localeHeaderName: string;
    localeCookieName: string;
    enableI18nCookieName: string;
    referrerLocaleCookieName: string;
    localeRoutingEnabledCookieName: string;
    resetLocaleCookieName: string;
  };
  experimentalCompilerOptions: CompilerOptions;
  disableInvalidLocaleWarning: boolean;
};

export const defaultWithGTConfigProps: DefaultGTConfigProps = {
  runtimeUrl: defaultRuntimeApiUrl,
  cacheUrl: defaultCacheUrl,
  defaultLocale: libraryDefaultLocale,
  getLocale: async () => libraryDefaultLocale,
  locales: [] as string[],
  maxConcurrentRequests: 100,
  maxBatchSize: 25,
  batchInterval: 50,
  renderSettings: getDefaultRenderSettings(process.env.NODE_ENV),
  _usingPlugin: false,
  ignoreBrowserLocales: false,
  headersAndCookies: {
    localeHeaderName: defaultLocaleHeaderName,
    localeCookieName: defaultLocaleCookieName,
    enableI18nCookieName: defaultEnableI18nCookieName,
    referrerLocaleCookieName: defaultReferrerLocaleCookieName,
    localeRoutingEnabledCookieName: defaultLocaleRoutingEnabledCookieName,
    resetLocaleCookieName: defaultResetLocaleCookieName,
  },
  // The compilers default every other option; the SWC plugin's own
  // compileTimeHash default is false.
  experimentalCompilerOptions: { type: 'none', compileTimeHash: true },
  disableInvalidLocaleWarning: false,
} as const;
