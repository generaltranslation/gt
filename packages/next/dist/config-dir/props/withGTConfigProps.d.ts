import { RenderMethod } from 'gt-react/internal';
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
    _usingPlugin?: boolean;
    [key: string]: any;
};
export default withGTConfigProps;
//# sourceMappingURL=withGTConfigProps.d.ts.map