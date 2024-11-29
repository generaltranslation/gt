import { libraryDefaultLocale, defaultCacheURL } from "generaltranslation/internal";
import getDefaultFromEnv from "../../utils/getDefaultFromEnv";

export default {
    apiKey: getDefaultFromEnv('GT_API_KEY'),
    projectID: getDefaultFromEnv('GT_PROJECT_ID'),
    baseURL: 'https://prod.gtx.dev',
    cacheURL: defaultCacheURL,
    defaultLocale: libraryDefaultLocale,
    getLocale: async () => libraryDefaultLocale,
    renderSettings: {
        method: "skeleton",
        timeout: null
    },
    getMetadata: async () => ({}),
    _maxConcurrectRequests: 2,
    _batchInterval: 1000
} as const;