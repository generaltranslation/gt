import { libraryDefaultLocale, defaultCacheUrl, defaultBaseUrl } from "generaltranslation/internal";
import getDefaultFromEnv from "../../utils/getDefaultFromEnv";
import { listSupportedLocales } from "@generaltranslation/supported-locales";

const defaultInitGTProps = {
    apiKey: getDefaultFromEnv('GT_API_KEY'),
    devApiKey: '',
    projectId: getDefaultFromEnv('GT_PROJECT_ID'),
    baseUrl: defaultBaseUrl,
    cacheUrl: defaultCacheUrl,
    cacheExpiryTime: 6000,
    defaultLocale: libraryDefaultLocale,
    getLocale: async () => libraryDefaultLocale,
    locales: listSupportedLocales(),
    env: getDefaultFromEnv('NODE_ENV'),
    getMetadata: async () => ({}),
    _maxConcurrectRequests: 100,
    _maxBatchSize: 25,
    _batchInterval: 10
} as const;

export default defaultInitGTProps;