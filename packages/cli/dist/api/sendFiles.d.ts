import { Settings } from '../types';
import { FileFormats } from '../types/data';
export interface FileToTranslate {
    content: string;
    fileName: string;
    fileFormat: FileFormats;
}
type ApiOptions = Settings & {
    publish: boolean;
    wait: boolean;
    timeout: string;
};
/**
 * Sends multiple files for translation to the API
 * @param files - Array of file objects to translate
 * @param options - The options for the API call
 * @returns The translated content or version ID
 */
export declare function sendFiles(files: FileToTranslate[], options: ApiOptions): Promise<any>;
export {};
