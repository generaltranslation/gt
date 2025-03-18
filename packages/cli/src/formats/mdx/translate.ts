import { sendFiles } from '../../api/sendFiles';
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
export async function translateFile(
  fileContent: string,
  options: TranslateFileOptions
): Promise<string | null> {
  try {
    const response = await sendFiles(
      [
        {
          content: fileContent,
          fileName: options.fileName,
          fileFormat: options.fileFormat,
        },
      ],
      {
        ...options,
        publish: false,
        wait: true,
        timeout: '600',
      }
    );
    return response;
  } catch (error) {
    console.error('Error translating file:', error);
    return null;
  }
}
