import { ResolvedFiles, Settings, TransformFiles } from '../../types';
import { FileFormats } from '../../types/data';
/**
 * Sends an entire file to the API for translation
 * @param fileContent - The raw content of the file to translate
 * @param options - Translation options including API settings
 * @returns The translated file content or null if translation failed
 */
export declare function translateFiles(filePaths: ResolvedFiles, placeholderPaths: ResolvedFiles, transformPaths: TransformFiles, fileFormat: FileFormats, options: Settings): Promise<void>;
