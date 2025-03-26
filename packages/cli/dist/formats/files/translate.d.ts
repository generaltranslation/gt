import { ResolvedFiles, Settings, TransformFiles } from '../../types';
import { DataFormat } from '../../types/data';
/**
 * Sends multiple files to the API for translation
 * @param filePaths - Resolved file paths for different file types
 * @param placeholderPaths - Placeholder paths for translated files
 * @param transformPaths - Transform paths for file naming
 * @param fileFormat - Format of the files
 * @param dataFormat - Format of the data within the files
 * @param options - Translation options including API settings
 * @returns Promise that resolves when translation is complete
 */
export declare function translateFiles(filePaths: ResolvedFiles, placeholderPaths: ResolvedFiles, transformPaths: TransformFiles, dataFormat: DataFormat | undefined, options: Settings): Promise<void>;
