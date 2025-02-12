declare const defaultInitGTProps: {
    readonly config: "./gt.config.json";
    readonly runtimeTranslation: true;
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
    readonly renderSettings: {
        method: import("gt-react/internal").RenderMethod;
        timeout?: number;
    };
};
export default defaultInitGTProps;
//# sourceMappingURL=defaultInitGTProps.d.ts.map