import { primitives } from "gt-react/internal";
import getDefaultFromEnv from "../utils/getDefaultFromEnv";

export default {
    apiKey: getDefaultFromEnv('GT_API_KEY'),
    projectID: getDefaultFromEnv('GT_PROJECT_ID'),
    baseURL: 'https://prod.gtx.dev',
    cacheURL: primitives.defaultCacheURL,
    defaultLocale: primitives.libraryDefaultLocale,
    getLocale: async () => primitives.libraryDefaultLocale,
    renderSettings: {
        method: "skeleton",
        timeout: null
    },
    getMetadata: async () => ({}),
    _maxConcurrectRequests: 2,
    _batchInterval: 1000
} as const;