import type { FileFormat } from '../../types-dir/api/file';
import {
  getSupportedTransformFormats,
  isSupportedFileFormatTransform,
} from '../../utils/isSupportedFileFormatTransform';

export type FileFormatTransformInput = {
  fileFormat?: FileFormat;
  transformFormat?: FileFormat;
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
  if (!file.transformFormat) return undefined;
  const fileLabel = file.fileName ?? file.fileId ?? 'unknown file';
  if (!file.fileFormat) {
    return `fileFormat is required when transformFormat is provided for ${fileLabel}`;
  }
  if (!isSupportedFileFormatTransform(file.fileFormat, file.transformFormat)) {
    const supported = getSupportedTransformFormats(file.fileFormat);
    const hint = supported
      ? ` Supported transformationFormat values for ${file.fileFormat}: ${supported.join(', ')}.`
      : '';
    return `Unsupported file format transform: ${file.fileFormat} -> ${file.transformFormat}.${hint}`;
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
