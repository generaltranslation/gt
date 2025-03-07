import { RetrievedTranslations } from '../../types/api';
import { DataFormat } from '../../types/data';
/**
 * Saves translations to a local directory
 * @param translations - The translations to save
 * @param translationsDir - The directory to save the translations to
 * @param fileType - The file type to save the translations as (file extension)
 */
export declare function saveTranslations(translations: RetrievedTranslations, translationsDir: string, dataFormat: DataFormat, fileExtension: string): void;
