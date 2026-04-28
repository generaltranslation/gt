import type { FileFormat } from '../../types/data.js';
import type {
  FilesOptions,
  Settings,
  SupportedFileExtension,
} from '../../types/index.js';
import { validateFileFormatTransforms } from 'generaltranslation/internal';

/**
 * Maps CLI config file keys to API file format enum values.
 */
export const CONFIG_FILE_TYPE_TO_FILE_FORMAT = {
  json: 'JSON',
  pot: 'POT',
  mdx: 'MDX',
  md: 'MD',
  ts: 'TS',
  js: 'JS',
  yaml: 'YAML',
  html: 'HTML',
  txt: 'TXT',
  twilioContentJson: 'TWILIO_CONTENT_JSON',
} as const satisfies Record<SupportedFileExtension, FileFormat>;

/**
 * Maps uppercase config aliases to the CLI's canonical lowercase file keys.
 */
export const FILE_FORMAT_TO_CONFIG_FILE_TYPE = {
  JSON: 'json',
  POT: 'pot',
  MDX: 'mdx',
  MD: 'md',
  TS: 'ts',
  JS: 'js',
  YAML: 'yaml',
  HTML: 'html',
  TXT: 'txt',
  TWILIO_CONTENT_JSON: 'twilioContentJson',
} as const satisfies Partial<Record<FileFormat, SupportedFileExtension>>;

/**
 * Maps API file format enum values to the extension the CLI should write.
 */
const FILE_FORMAT_EXTENSIONS = {
  GTJSON: 'json',
  JSON: 'json',
  PO: 'po',
  POT: 'pot',
  YAML: 'yaml',
  MDX: 'mdx',
  MD: 'md',
  TS: 'ts',
  JS: 'js',
  HTML: 'html',
  TXT: 'txt',
  TWILIO_CONTENT_JSON: 'json',
} as const satisfies Record<FileFormat, string>;

/**
 * Converts uppercase file format config keys into the CLI's canonical lowercase keys.
 *
 * This lets users write either `files.POT` or `files.pot` while keeping the
 * rest of the CLI on its existing lowercase file-type convention.
 */
export function normalizeFilesOptions(files: FilesOptions): FilesOptions {
  const normalized = { ...files } as FilesOptions & Record<string, unknown>;

  for (const [fileFormat, fileType] of Object.entries(
    FILE_FORMAT_TO_CONFIG_FILE_TYPE
  ) as [string, SupportedFileExtension][]) {
    const uppercaseConfig = normalized[fileFormat] as
      | FilesOptions[SupportedFileExtension]
      | undefined;
    if (!normalized[fileType] && uppercaseConfig) {
      normalized[fileType] = uppercaseConfig;
    }
    delete normalized[fileFormat];
  }

  return normalized;
}

/**
 * Validates and resolves a configured output format for a source file type.
 *
 * Throws when the requested source -> output format is not supported by
 * `generaltranslation/internal`.
 */
export function resolveTransformationFormat(
  fileType: SupportedFileExtension,
  transformationFormat: string | undefined
): FileFormat | undefined {
  if (!transformationFormat) return undefined;

  // Normalize to uppercase to match the FileFormat enum (e.g. "po" -> "PO")
  const normalized = transformationFormat.toUpperCase() as FileFormat;
  const fileFormat = CONFIG_FILE_TYPE_TO_FILE_FORMAT[fileType];
  validateFileFormatTransforms([
    {
      fileFormat,
      transformFormat: normalized,
      fileName: `files.${fileType}`,
    },
  ]);

  return normalized;
}

/**
 * Returns the API upload/enqueue property for a file type when one is configured.
 */
export function getTransformFormatProperty(
  settings: Settings,
  fileType: SupportedFileExtension
): { transformFormat?: FileFormat } {
  const transformFormat = settings.files?.transformFormats?.[fileType];
  return transformFormat ? { transformFormat } : {};
}

/**
 * Returns the preferred file extension for a translated file format.
 */
export function getFileExtensionForFormat(format: FileFormat): string {
  return FILE_FORMAT_EXTENSIONS[format];
}

/**
 * Rewrites a path's extension to match the translated file format.
 */
export function replaceFileExtensionForFormat(
  filePath: string,
  format: FileFormat
): string {
  const extension = getFileExtensionForFormat(format);
  return /\.[^/.]+$/.test(filePath)
    ? filePath.replace(/\.[^/.]+$/, `.${extension}`)
    : `${filePath}.${extension}`;
}

/**
 * Detects whether any configured format transform changes the output file type.
 */
export function hasNonIdentityFileFormatTransform(settings: Settings): boolean {
  return Object.entries(settings.files?.transformFormats || {}).some(
    ([fileType, transformFormat]) =>
      transformFormat &&
      CONFIG_FILE_TYPE_TO_FILE_FORMAT[fileType as SupportedFileExtension] !==
        transformFormat
  );
}

/**
 * Returns true when the configured transform for a file type changes its format.
 */
export function hasNonIdentityFileFormatTransformForType(
  settings: Settings,
  fileType: SupportedFileExtension
): boolean {
  const transformFormat = settings.files?.transformFormats?.[fileType];
  return !!(
    transformFormat &&
    CONFIG_FILE_TYPE_TO_FILE_FORMAT[fileType] !== transformFormat
  );
}
