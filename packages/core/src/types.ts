import type {
  ApiClientConfig,
  CreateTagData,
  CreateTagResponse,
  GetOrphanedFilesResponse,
} from '@generaltranslation/api';
import type {
  CustomMapping as FormatCustomMapping,
  DataFormat as FormatDataFormat,
} from '@generaltranslation/format/types';
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
  TranslateOptions,
} from './types-dir/api/entry';
export type { RuntimeFileFormat } from '@generaltranslation/api';
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
export type CreateTagOptions = CreateTagData['body'];
export type CreateTagResult = CreateTagResponse;
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
export { isBinaryFileFormat, BINARY_FILE_FORMATS } from './types-dir/api/file';
export type { TranslateManyResult } from './types-dir/api/translateMany';
export type {
  TranslationResult,
  TranslationError,
  TranslationResultReference,
} from './types-dir/api/translate';
export type { BranchDataResult } from './types-dir/api/branch';
export type { BranchQuery } from './translate/queryBranchData';
export type { FileDataQuery, FileDataResult } from './translate/queryFileData';
export type OrphanedFile = GetOrphanedFilesResponse['orphanedFiles'][number];
export type GetOrphanedFilesResult = GetOrphanedFilesResponse;
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
 * @param baseUrl - The base URL of the translation request. Defaults to the runtime API URL.
 * @param apiKey - The API key of the translation request.
 * @param apiVersion - The `gt-api-version` header value. Defaults to the SDK's current version.
 * @param fetch - A custom fetch implementation. Timeout and error adaptation still wrap it.
 * @param timeoutMs - Request timeout. Omitted selects the runtime default, `0` is a
 * literal zero, and `false` disables the runtime-owned timer (a custom fetch may still cancel).
 * @param userTokenProvider - Lazily supplies a user access token when no API key is set.
 */
export type TranslationRequestConfig = Pick<
  ApiClientConfig,
  'apiKey' | 'apiVersion' | 'fetch' | 'timeoutMs' | 'userTokenProvider'
> & {
  projectId: string;
  baseUrl?: string;
};

/**
 * TranslateConfig is the explicit configuration for the named `translate` and
 * `translateMany` helpers exported from `generaltranslation/runtime`. Nothing is
 * read from the environment; a missing API key/provider or project ID fails
 * before any request is sent.
 *
 * @param customMapping - Custom locale mapping used to canonicalize request locales.
 */
export type TranslateConfig = Omit<TranslationRequestConfig, 'projectId'> & {
  projectId?: string;
  customMapping?: FormatCustomMapping;
};
