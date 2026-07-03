import { FileToUpload } from 'generaltranslation/types';
import { FileTranslationData } from '../../workflows/download.js';

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
        ...(file.fileFormat === 'GTJSON' && {
          componentCount: countGtJsonComponents(file.content),
        }),
      },
    ])
  );
}

/**
 * Counts source components in a GTJSON template so the download step can
 * report how many were withheld from the served output pending review.
 */
function countGtJsonComponents(content: string): number | undefined {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.keys(parsed).length;
    }
  } catch {
    // Not parsable — no count available
  }
  return undefined;
}
