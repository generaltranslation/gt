import { Settings, Updates } from '../types';
type ApiOptions = Settings & {
    publish: boolean;
    wait: boolean;
    timeout: string;
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
