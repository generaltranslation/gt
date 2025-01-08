declare const defaultInitGTProps: {
    readonly remoteCache: true;
    readonly runtimeTranslation: true;
    readonly apiKey: string;
    readonly devApiKey: "";
    readonly projectId: string;
    readonly runtimeUrl: "https://runtime.gtx.dev";
    readonly cacheUrl: "https://cdn.gtx.dev";
    readonly cacheExpiryTime: 60000;
    readonly defaultLocale: "en-US";
    readonly getLocale: () => Promise<"en-US">;
    readonly locales: string[];
    readonly getMetadata: () => Promise<{}>;
    readonly maxConcurrentRequests: 100;
    readonly maxBatchSize: 25;
    readonly batchInterval: 50;
};
export default defaultInitGTProps;
//# sourceMappingURL=defaultInitGTProps.d.ts.map