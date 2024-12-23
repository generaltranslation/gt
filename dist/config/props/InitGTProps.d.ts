type InitGTProps = {
    dictionary?: string;
    i18n?: string;
    apiKey?: string;
    projectId?: string;
    baseUrl?: string;
    clientBaseUrl?: string;
    cacheUrl?: string;
    cacheExpiryTime?: number;
    locales?: string[];
    defaultLocale?: string;
    getLocale?: () => Promise<string>;
    renderSettings?: {
        method: "skeleton" | "replace" | "hang" | "subtle";
        timeout: number | null;
    };
    getMetadata?: () => Promise<Record<string, any>>;
    _maxConcurrentRequests?: number;
    _maxBatchSize?: number;
    _batchInterval?: number;
    description?: string;
    preferredModel?: string;
    [key: string]: any;
};
export default InitGTProps;
//# sourceMappingURL=InitGTProps.d.ts.map