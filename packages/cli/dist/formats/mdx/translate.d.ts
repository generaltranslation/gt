import { Settings } from '../../types';
import { FileFormats } from '../../types/data';
interface TranslateFileOptions extends Settings {
    fileName: string;
    fileFormat: FileFormats;
    fileExtension: string;
}
/**
 * Sends an entire file to the API for translation
 * @param fileContent - The raw content of the file to translate
 * @param options - Translation options including API settings
 * @returns The translated file content or null if translation failed
 */
export declare function translateFile(fileContent: string, options: TranslateFileOptions): Promise<string | null>;
export {};
