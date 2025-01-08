import { libraryDefaultLocale, defaultCacheUrl, defaultRuntimeApiUrl } from "generaltranslation/internal";
import getDefaultFromEnv from "../../utils/getDefaultFromEnv";
import { listSupportedLocales } from "@generaltranslation/supported-locales";

const defaultInitGTProps = {
    remoteCache: true,
    runtimeTranslation: true,
    apiKey: getDefaultFromEnv('GT_API_KEY'),
    devApiKey: '',
    projectId: getDefaultFromEnv('GT_PROJECT_ID'),
    runtimeUrl: defaultRuntimeApiUrl,
    cacheUrl: defaultCacheUrl,
    cacheExpiryTime: 60000,
    defaultLocale: libraryDefaultLocale,
    getLocale: async () => libraryDefaultLocale,
    locales: listSupportedLocales(),
    getMetadata: async () => ({}),
    maxConcurrentRequests: 100,
    maxBatchSize: 25,
    batchInterval: 50
} as const;

export default defaultInitGTProps;