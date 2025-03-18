import { RetrievedTranslations } from '../../types/api';
import { DataFormat } from '../../types/data';
import { ResolvedFiles } from '../../types';
/**
 * Saves translations to a file
 * @param translations - The translations to save
 * @param filePath - The file path to save the translations to
 * @param dataFormat - The data format to save the translations as
 */
export declare function saveTranslations(translations: RetrievedTranslations, filepaths: ResolvedFiles, dataFormat: DataFormat): void;
