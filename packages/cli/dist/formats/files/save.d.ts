import { DataFormat } from '../../types/data';
/**
 * Saves translated MDX/MD file content to the appropriate location
 */
export declare function saveTranslatedFile(translatedContent: string, outputDir: string, fileName: string, dataFormat: DataFormat, locales: string[]): Promise<void>;
