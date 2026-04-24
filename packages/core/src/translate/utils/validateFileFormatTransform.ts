import type { FileFormat } from '../../types-dir/api/file';
import { isSupportedFileFormatTransform } from '../../utils/isSupportedFileFormatTransform';

export type FileFormatTransformInput = {
  fileFormat?: FileFormat;
  formatTransform?: FileFormat;
  fileName?: string;
  fileId?: string;
};

/**
 * Returns a user-facing validation error when a requested file format transform
 * is missing source format context or is not currently supported.
 */
export function getFileFormatTransformError(
  file: FileFormatTransformInput
): string | undefined {
  if (!file.formatTransform) return undefined;
  const fileLabel = file.fileName ?? file.fileId ?? 'unknown file';
  if (!file.fileFormat) {
    return `fileFormat is required when formatTransform is provided for ${fileLabel}`;
  }
  if (!isSupportedFileFormatTransform(file.fileFormat, file.formatTransform)) {
    return `Unsupported file format transform: ${file.fileFormat} -> ${file.formatTransform}`;
  }
  return undefined;
}

/**
 * Validates file format transforms before sending upload/enqueue requests.
 */
export function validateFileFormatTransforms(
  files: FileFormatTransformInput[]
): void {
  for (const file of files) {
    const error = getFileFormatTransformError(file);
    if (error) throw new Error(error);
  }
}
