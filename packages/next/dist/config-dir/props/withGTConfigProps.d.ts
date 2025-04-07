import { RenderMethod } from 'gt-react/internal';
export type HeadersAndCookies = {
    localeHeaderName?: string;
    localeCookieName?: string;
    referrerLocaleCookieName?: string;
    localeRoutingEnabledCookieName?: string;
    resetLocaleCookieName?: string;
};
type withGTConfigProps = {
    dictionary?: string;
    config?: string;
    loadTranslationsPath?: string;
    loadDictionaryPath?: string;
    apiKey?: string;
    projectId?: string;
    runtimeUrl?: string | null;
    cacheUrl?: string | null;
    cacheExpiryTime?: number;
    locales?: string[];
    defaultLocale?: string;
    ignoreBrowserLocales?: boolean;
    getLocale?: () => Promise<string>;
    renderSettings?: {
        method: RenderMethod;
        timeout?: number;
    };
    maxConcurrentRequests?: number;
    maxBatchSize?: number;
    batchInterval?: number;
    description?: string;
    headersAndCookies?: HeadersAndCookies;
    _usingPlugin?: boolean;
    [key: string]: any;
};
export default withGTConfigProps;
//# sourceMappingURL=withGTConfigProps.d.ts.map