import { libraryDefaultLocale, defaultCacheUrl, defaultBaseUrl } from "generaltranslation/internal";
import getDefaultFromEnv from "../../utils/getDefaultFromEnv";
import { listSupportedLocales } from "@generaltranslation/supported-locales";

export default {
    apiKey: getDefaultFromEnv('GT_API_KEY'),
    devApiKey: getDefaultFromEnv('DEV_GT_API_KEY'),
    projectId: getDefaultFromEnv('GT_PROJECT_ID'),
    baseUrl: defaultBaseUrl,
    cacheUrl: defaultCacheUrl,
    cacheExpiryTime: 6000,
    defaultLocale: libraryDefaultLocale,
    getLocale: async () => libraryDefaultLocale,
    locales: listSupportedLocales(),
    renderSettings: {
        method: "skeleton",
        timeout: (() => { 
            const NODE_ENV = getDefaultFromEnv('NODE_ENV'); 
            return NODE_ENV === "development" || NODE_ENV === "test"; 
        })() ? null : 8000
    },
    env: getDefaultFromEnv('NODE_ENV'),
    getMetadata: async () => ({}),
    _maxConcurrectRequests: 100,
    _batchInterval: 10
} as const;