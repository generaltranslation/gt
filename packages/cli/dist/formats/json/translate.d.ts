import { Settings } from '../../types';
import { DataFormat } from '../../types/data';
import { ResolvedFiles } from '../../types';
/**
 * Translates a JSON object and saves the translations to a local directory
 * @param sourceJson - The source JSON object
 * @param defaultLocale - The default locale
 * @param locales - The locales to translate to
 * @param library - The library to use
 * @param apiKey - The API key for the General Translation API
 * @param projectId - The project ID
 * @param config - The config file path
 * @param translationsDir - The directory to save the translations to
 * @param fileType - The file type to save the translations as (file extension)
 */
export declare function translateJson(sourceJson: any, settings: Settings, dataFormat: DataFormat, filepaths: ResolvedFiles): Promise<void>;
