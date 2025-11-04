import { DataFormat } from './content';
import { FileFormat } from './file';

/**
 * Core file entity that flows through the entire translation pipeline.
 * This type represents a file at any stage of its lifecycle, from initial
 * creation through upload and translation.
 */
export type FileEntity = {
  // Identity (immutable once created)
  readonly fileName: string;
  readonly fileFormat: FileFormat;
  readonly dataFormat?: DataFormat;

  // Content
  content: string;
  locale: string;

  // Server references (populated after upload)
  branchId?: string;
  fileId?: string;
  versionId?: string;

  // Optional metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formatMetadata?: Record<string, any>;
};

/**
 * A file that has not yet been uploaded to the server.
 * Server reference fields are explicitly undefined.
 */
export type NotYetUploadedFile = Omit<
  FileEntity,
  'branchId' | 'fileId' | 'versionId'
> & {
  branchId?: undefined;
  fileId?: undefined;
  versionId?: undefined;
};

/**
 * A file that has been successfully uploaded to the server.
 * Server reference fields are guaranteed to be present.
 */
export type UploadedFile = Required<
  Pick<FileEntity, 'branchId' | 'fileId' | 'versionId'>
> &
  Omit<FileEntity, 'branchId' | 'fileId' | 'versionId'>;

/**
 * Type guard to check if a file has been uploaded.
 */
export function isUploaded(file: FileEntity): file is UploadedFile {
  return !!(file.branchId && file.fileId && file.versionId);
}

/**
 * Assertion to ensure a file has been uploaded.
 * Throws an error if the file is missing server references.
 */
export function assertUploaded(file: FileEntity): asserts file is UploadedFile {
  if (!file.branchId || !file.fileId || !file.versionId) {
    throw new Error(
      `File "${file.fileName}" has not been uploaded. Missing server references.`
    );
  }
}

/**
 * Convert an array of FileEntity to the minimal reference format
 * needed for API calls after upload.
 */
export function toFileRefs(files: UploadedFile[]): FileUploadRef[] {
  return files.map((f) => ({
    branchId: f.branchId,
    fileId: f.fileId,
    versionId: f.versionId,
    fileName: f.fileName,
    fileFormat: f.fileFormat,
    dataFormat: f.dataFormat,
    locale: f.locale,
  }));
}

/**
 * Reference to an uploaded file (minimal data needed for subsequent API calls)
 */
export type FileUploadRef = {
  branchId: string;
  fileId: string;
  versionId: string;
  fileName: string;
  fileFormat: FileFormat;
  dataFormat?: DataFormat;
  locale?: string;
};
