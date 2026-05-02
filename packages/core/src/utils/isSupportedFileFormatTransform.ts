import type { FileFormat } from '../types-dir/api/file';

const SUPPORTED_TRANSFORMATIONS = {
  GTJSON: ['GTJSON'],
  JSON: ['JSON'],
  PO: ['PO'],
  // POT templates can produce translated PO catalog files.
  POT: ['POT', 'PO'],
  YAML: ['YAML'],
  MDX: ['MDX'],
  MD: ['MD'],
  TS: ['TS'],
  JS: ['JS'],
  HTML: ['HTML'],
  TXT: ['TXT'],
  TWILIO_CONTENT_JSON: ['TWILIO_CONTENT_JSON'],
} as const satisfies Record<FileFormat, FileFormat[]>;

/**
 * Checks whether a file format transformation is supported during translation.
 * @param from - The source file format.
 * @param to - The target file format.
 * @returns True if the transformation is supported; otherwise false.
 */
export function isSupportedFileFormatTransform(
  from: FileFormat,
  to: FileFormat
): boolean {
  const toFormats: FileFormat[] | undefined = SUPPORTED_TRANSFORMATIONS[from];
  return toFormats?.includes(to) ?? false;
}
