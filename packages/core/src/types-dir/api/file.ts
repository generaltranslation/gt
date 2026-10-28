import type { FileFormat, JsonObject } from '@generaltranslation/api';
import type { DataFormat } from '@generaltranslation/format';
import { Updates } from './enqueueFiles';

/**
 * File formats whose content travels through the pipeline already
 * base64-encoded, so the usual UTF-8 encode/decode steps are skipped and the
 * bytes reach the API unaltered.
 *
 * LOTTIE qualifies because it is a zip bundle, and PNG, JPEG and MP4 are media. Apple's `.strings` and
 * `.stringsdict` do not: they are text in whichever encoding Xcode wrote, and
 * the client decodes that to UTF-8 before upload and restores it on write, so
 * only the client ever handles their bytes.
 */
const BINARY_FILE_FORMATS: ReadonlySet<FileFormat> = new Set<FileFormat>([
  'LOTTIE',
  'PNG',
  'JPEG',
  'MP4',
]);

/**
 * Whether a file format's content is carried as base64 end-to-end rather than
 * as a UTF-8 text string.
 */
export function isBinaryFileFormat(fileFormat: FileFormat): boolean {
  return BINARY_FILE_FORMATS.has(fileFormat);
}

/**
 * Metadata for files or entries.
 */
export type FormatMetadata = JsonObject | Updates[number]['metadata'];

/**
 * File object structure for uploading files.
 * @see {@link FileReferenceOptionalBranchId}
 * @property {string} content - Content of the file.
 * @property {string} locale - The locale of the file (e.g. 'en', 'de', 'es', etc.)
 * @property {FormatMetadata} [formatMetadata] - Optional metadata for the file, specific to the format of the file
 * @property {string} [incomingBranchId] - The ID of the incoming branch of the file.
 * @property {string} [checkedOutBranchId] - The ID of the checked-out branch of the file.
 */
export type FileToUpload = Omit<FileReference, 'branchId'> & {
  content: string;
  locale: string;
  // Optional output format requested for generated translations.
  transformFormat?: FileFormat;
  formatMetadata?: FormatMetadata;
  branchId?: string;
  incomingBranchId?: string;
  checkedOutBranchId?: string;
};

/**
 * File object structure for referencing files.
 * @property {string} fileId - The ID of the file.
 * @property {string} versionId - The ID of the version of the file
 * @property {string} branchId - The ID of the branch of the file
 * @property {string} locale - The locale of the file (e.g. 'en', 'de', 'es', etc.)
 * @property {string} fileName - The name of the file.
 * @property {FileFormat} fileFormat - The format of the file (JSON, MDX, MD, etc.).
 * @property {DataFormat} [dataFormat] - Optional format of the data within the file.
 */
export type FileReference = {
  fileId: string;
  versionId: string;
  branchId: string;
  fileName: string;
  fileFormat: FileFormat;
  // Optional output format requested for generated translations.
  transformFormat?: FileFormat;
  dataFormat?: DataFormat;
};
