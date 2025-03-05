import { Updates } from '../types';
type ApiOptions = {
    baseUrl: string;
    config: string;
    apiKey: string;
    projectId: string;
    defaultLocale: string;
    locales: string[];
    additionalLocales?: string[] | undefined;
    publish: boolean;
    versionId?: string;
    wait: boolean;
    timeout: string;
    translationsDir?: string;
};
export declare function sendUpdates(updates: Updates, options: ApiOptions): Promise<void>;
export {};
