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
/**
 * Sends updates to the API
 * @param updates - The updates to send
 * @param options - The options for the API call
 * @returns The versionId of the updated project
 */
export declare function sendUpdates(updates: Updates, options: ApiOptions): Promise<{
    versionId: any;
} | undefined>;
export {};
