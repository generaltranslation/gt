import { DataFormat } from '../jsx/content';
import { Updates } from './enqueueFiles';

export type FileFormat =
  | 'GTJSON'
  | 'JSON'
  | 'YAML'
  | 'MDX'
  | 'MD'
  | 'TS'
  | 'JS'
  | 'HTML'
  | 'TXT';

/**
 * File object structure for uploading files
 * @param content - Content of the file
 * @param fileName - Unique identifier for the file (such as the file path + file name)
 * @param fileFormat - The format of the file (JSON, MDX, MD, etc.)
 * @param formatMetadata - Optional metadata for the file, specific to the format of the file
 * @param dataFormat - Optional format of the data within the file
 */
export type FileToUpload = {
  content: string;
  formatMetadata?: Record<string, any> | Updates[number]['metadata'];
  incomingBranchId?: string;
  checkedOutBranchId?: string;
  locale: string;
} & Omit<FileReference, 'branchId'> & { branchId?: string };

/**
 * File object structure for referencing files
 * @param fileId - The ID of the file
 * @param versionId - The ID of the version of the file
 * @param branchId - The ID of the branch of the file
 * @param locale - The locale of the file ()
 */
export type FileReference = {
  fileId: string;
  versionId: string;
  branchId: string;
  fileName: string;
  fileFormat: FileFormat;
  dataFormat?: DataFormat;
};
