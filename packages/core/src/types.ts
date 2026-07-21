import type { DataFormat as FormatDataFormat } from '@generaltranslation/format/types';
export { HTML_CONTENT_PROPS } from '@generaltranslation/format/types';
export type {
  Content,
  CustomMapping,
  CustomRegionMapping,
  CutoffFormatOptions,
  DataFormat,
  FormatVariables,
  GTProp,
  HtmlContentPropKeysRecord,
  HtmlContentPropValuesRecord,
  I18nextMessage,
  IcuMessage,
  JsxChild,
  JsxChildren,
  JsxElement,
  LocaleProperties,
  StringContent,
  StringFormat,
  StringMessage,
  Variable,
  VariableType,
} from '@generaltranslation/format/types';
export type {
  ActionType as EntryActionType,
  EntryMetadata,
  TranslateManyEntry,
} from './types-dir/api/entry';
export type { HashMetadata } from './id/types';
export type {
  GTConfig,
  GTFilesConfig,
  GTOutputFileConfig,
  GTParsingFlags,
} from './types-dir/config';
export type {
  JsonObject,
  JsonPrimitive,
  JsonValue,
} from './types-dir/api/json';

export type { CheckFileTranslationsOptions } from './types-dir/api/checkFileTranslations';
export type {
  DownloadFileBatchOptions,
  DownloadFileBatchResult,
} from './types-dir/api/downloadFileBatch';
export type { EnqueueFilesOptions } from './translate/enqueueFiles';
export type { EnqueueFilesResult, Updates } from './types-dir/api/enqueueFiles';
export type { CreateTagOptions, CreateTagResult } from './translate/createTag';
export type { SetupProjectFileReference } from './translate/setupProject';
export type { FileToUpload } from './types-dir/api/file';
export type { FileUpload } from './types-dir/api/uploadFiles';
export type { FileReference } from './types-dir/api/file';
export type {
  PublishFileEntry,
  PublishFilesResult,
} from './translate/publishFiles';
export type { DownloadedFile } from './types-dir/api/downloadFileBatch';
export type { DownloadFileOptions } from './types-dir/api/downloadFile';
export type { FileFormat } from './types-dir/api/file';
export type { TranslateManyResult } from './types-dir/api/translateMany';
export type {
  TranslationResult,
  TranslationError,
  TranslationResultReference,
} from './types-dir/api/translate';
export type { BranchDataResult } from './types-dir/api/branch';
export type { BranchQuery } from './translate/queryBranchData';
export type { FileDataQuery, FileDataResult } from './translate/queryFileData';
export type {
  OrphanedFile,
  GetOrphanedFilesResult,
} from './translate/getOrphanedFiles';
export type {
  MoveMapping,
  MoveResult,
  ProcessMovesResponse,
  ProcessMovesOptions,
} from './translate/processFileMoves';
export type {
  JobStatus,
  CheckJobStatusResult,
} from './translate/checkJobStatus';
export type {
  AwaitJobsOptions,
  AwaitJobsResult,
  JobResult,
} from './translate/awaitJobs';
export type {
  SubmitUserEditDiff,
  SubmitUserEditDiffsPayload,
} from './translate/submitUserEditDiffs';

export type {
  Transformation,
  TransformationPrefix,
  VariableTransformationSuffix,
  InjectionType,
} from './types-dir/transformations';

export type Metadata = {
  maxChars?: number;
  context?: string;
  id?: string;
  hash?: string;
  format?: string;
  requiresReview?: boolean;
  dataFormat?: FormatDataFormat;
  sourceLocale?: string;
  actionType?: 'standard' | 'fast' | string;
  filePaths?: string[];
  [key: string]: unknown;
};

// ----- VARIABLES ----- //

// ----- TRANSLATION REQUEST TYPES ----- //

/**
 * TranslationRequestConfig is used to configure the translation request.
 *
 * @param projectId - The project ID of the translation request.
 * @param baseUrl - The base URL of the translation request.
 * @param apiKey - The API key of the translation request.
 */
export type TranslationRequestConfig = {
  projectId: string;
  baseUrl?: string;
  apiKey?: string;
};
