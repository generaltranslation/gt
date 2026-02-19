import { FileToUpload } from 'generaltranslation/types';
import { FileTranslationData } from '../../workflow/downloadTranslations.js';

/**
 * Convert files to a file version data object
 * @param files - The files to get the version data for
 * @returns The version data for each file
 *
 * @example
 * const { allFiles } = await collectFiles(options, settings, library);
 * if (allFiles.length > 0) {
 *   const fileVersionData = getFileVersionData(allFiles);
 *   console.log(fileVersionData);
 * }
 */
export function convertToFileTranslationData(
  files: FileToUpload[]
): FileTranslationData {
  return Object.fromEntries(
    files.map((file) => [
      file.fileId,
      {
        versionId: file.versionId,
        fileName: file.fileName,
      },
    ])
  );
}
