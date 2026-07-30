import type { DataFormat } from '@generaltranslation/format/types';
import { Updates } from './enqueueFiles';
import type { JsonObject } from './json';

export type FileFormat =
  | 'GTJSON'
  | 'JSON'
  | 'PO'
  | 'POT'
  | 'YAML'
  | 'MDX'
  | 'MD'
  | 'TS'
  | 'JS'
  | 'HTML'
  | 'TXT'
  | 'TWILIO_CONTENT_JSON'
  | 'LOTTIE';

/**
 * File formats whose content is binary (e.g. zip bundles) rather than text.
 * Their content travels through the pipeline already base64-encoded, so the
 * usual UTF-8 encode/decode steps must be skipped to avoid corrupting bytes.
 */
export const BINARY_FILE_FORMATS: ReadonlySet<FileFormat> = new Set<FileFormat>(
  ['LOTTIE']
);

/**
 * Whether a file format's content is binary (carried as base64 end-to-end)
 * rather than a UTF-8 text string.
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

/**
 * File reference object structure for referencing files.
 * @see {@link FileReference}
 * @property {string} [branchId] - The ID of the branch of the file
 */
export type FileReferenceIds = Omit<
  FileReference,
  'branchId' | 'fileName' | 'fileFormat' | 'dataFormat'
> & {
  branchId?: string;
  fileName?: string;
  fileFormat?: FileFormat;
  transformFormat?: FileFormat;
  dataFormat?: DataFormat;
};
