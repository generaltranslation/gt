import { Settings, SupportedLibraries, Updates } from '../types';
import { DataFormat } from '../types/data';
type ApiOptions = Settings & {
    publish: boolean;
    wait: boolean;
    timeout: string;
    dataFormat: DataFormat;
};
/**
 * Sends updates to the API
 * @param updates - The updates to send
 * @param options - The options for the API call
 * @returns The versionId of the updated project
 */
export declare function sendUpdates(updates: Updates, options: ApiOptions, library: SupportedLibraries): Promise<{
    versionId: any;
} | undefined>;
export {};
