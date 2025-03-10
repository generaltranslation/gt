declare const defaultWithGTConfigProps: {
    readonly config: "./gt.config.json";
    readonly runtimeUrl: "https://runtime.gtx.dev";
    readonly cacheUrl: "https://cdn.gtx.dev";
    readonly defaultLocale: "en-US";
    readonly getLocale: () => Promise<"en-US">;
    readonly locales: string[];
    readonly maxConcurrentRequests: 100;
    readonly maxBatchSize: 25;
    readonly batchInterval: 50;
    readonly cacheExpiryTime: 60000;
    readonly renderSettings: {
        method: import("gt-react/internal").RenderMethod;
        timeout: number;
    };
    readonly _usingPlugin: false;
};
export default defaultWithGTConfigProps;
//# sourceMappingURL=defaultWithGTConfigProps.d.ts.map