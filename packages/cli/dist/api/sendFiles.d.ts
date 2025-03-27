import { Settings } from '../types';
import { FileFormats, DataFormat } from '../types/data';
export interface FileToTranslate {
    content: string;
    fileName: string;
    fileFormat: FileFormats;
    dataFormat: DataFormat;
}
type ApiOptions = Settings & {
    publish: boolean;
    wait: boolean;
};
/**
 * Sends multiple files for translation to the API
 * @param files - Array of file objects to translate
 * @param options - The options for the API call
 * @returns The translated content or version ID
 */
export declare function sendFiles(files: FileToTranslate[], options: ApiOptions): Promise<{
    data: any;
    locales: any;
    translations: any;
}>;
export {};
