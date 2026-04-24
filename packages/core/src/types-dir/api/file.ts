import { DataFormat } from '../jsx/content';
import { Updates } from './enqueueFiles';

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
  | 'TWILIO_CONTENT_JSON';

/**
 * Metadata for files or entries
 */
type FormatMetadata = Record<string, any> | Updates[number]['metadata'];

/**
 * File object structure for uploading files
 * @see {@link FileReferenceOptionalBranchId}
 * @property {string} content - Content of the file
 * @property {string} locale - The locale of the file (e.g. 'en', 'de', 'es', etc.)
 * @property {FormatMetadata} [formatMetadata] - Optional metadata for the file, specific to the format of the file
 * @property {string} [incomingBranchId] - The ID of the incoming branch of the file
 * @property {string} [checkedOutBranchId] - The ID of the checked out branch of the file
 */
export type FileToUpload = Omit<FileReference, 'branchId'> & {
  content: string;
  locale: string;
  // Optional output format requested for generated translations.
  formatTransform?: FileFormat;
  formatMetadata?: FormatMetadata;
  branchId?: string;
  incomingBranchId?: string;
  checkedOutBranchId?: string;
};

/**
 * File object structure for referencing files
 * @property {string} fileId - The ID of the file
 * @property {string} versionId - The ID of the version of the file
 * @property {string} branchId - The ID of the branch of the file
 * @property {string} locale - The locale of the file (e.g. 'en', 'de', 'es', etc.)
 * @property {string} fileName - The name of the file
 * @property {FileFormat} fileFormat - The format of the file (JSON, MDX, MD, etc.)
 * @property {DataFormat} [dataFormat] - Optional format of the data within the file
 */
export type FileReference = {
  fileId: string;
  versionId: string;
  branchId: string;
  fileName: string;
  fileFormat: FileFormat;
  // Optional output format requested for generated translations.
  formatTransform?: FileFormat;
  dataFormat?: DataFormat;
};

/**
 * File reference object structure for referencing files
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
  formatTransform?: FileFormat;
  dataFormat?: DataFormat;
};
