declare class IntlCache {
    private cache;
    constructor();
    private _generateKey;
    get<K extends keyof typeof Intl>(constructor: K, locales: string | string[], options?: {}): (InstanceType<typeof Intl[K]>);
}
export declare const intlCache: IntlCache;
export {};
