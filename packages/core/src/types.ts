import type { LocaleProperties } from './locales/getLocaleProperties';

import type { Variable, VariableType } from './types-dir/jsx/variables';

import {
  type IcuMessage,
  type I18nextMessage,
  type StringMessage,
  type StringContent,
  type JsxChildren,
  type JsxChild,
  type JsxElement,
  type GTProp,
  type HtmlContentPropKeysRecord,
  type HtmlContentPropValuesRecord,
  HTML_CONTENT_PROPS,
  type DataFormat,
  type Content,
  type StringFormat,
} from './types-dir/jsx/content';
import type {
  ActionType,
  EntryMetadata,
  TranslateManyEntry,
} from './types-dir/api/entry';
import type { HashMetadata } from './id/types';
export type { TranslationStatusResult } from './types-dir/api/translationStatus';

export {
  IcuMessage,
  StringMessage,
  I18nextMessage,
  StringContent,
  JsxChildren,
  JsxChild,
  JsxElement,
  GTProp,
  HtmlContentPropKeysRecord,
  HtmlContentPropValuesRecord,
  HTML_CONTENT_PROPS,
  Variable,
  VariableType,
  LocaleProperties,
  DataFormat,
  ActionType as EntryActionType,
  EntryMetadata,
  TranslateManyEntry,
  Content,
  StringFormat,
  HashMetadata,
};

export type {
  FileTranslationQuery,
  CheckFileTranslationsOptions,
} from './types-dir/api/checkFileTranslations';
export type {
  DownloadFileBatchOptions,
  DownloadFileBatchResult,
} from './types-dir/api/downloadFileBatch';
export type {
  FetchTranslationsOptions,
  FetchTranslationsResult,
  RetrievedTranslations,
} from './types-dir/api/fetchTranslations';
export type {
  EnqueueFilesOptions,
  EnqueueFilesResult,
  Updates,
} from './types-dir/api/enqueueFiles';
export type { CreateTagOptions, CreateTagResult } from './translate/createTag';
export type { FileToUpload } from './types-dir/api/file';
export type { FileUpload } from './types-dir/api/uploadFiles';
export type {
  EnqueueEntriesOptions,
  EnqueueEntriesResult,
} from './types-dir/api/enqueueEntries';
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

/**
 * @deprecated Use {@link Content} instead.
 */
export type _Content = string | Array<string | Variable>;

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
  sourceLocale?: string;
  actionType?: 'standard' | 'fast' | string;
  filePaths?: string[];
  [key: string]: any;
};

export type FormatVariables = Record<
  string,
  string | number | boolean | null | undefined | Date
>;

/**
 * @deprecated This type is deprecated and will be removed in a future version.
 */
export type Update =
  | {
      type: 'content';
      data: {
        source: _Content;
        metadata: Metadata;
      };
    }
  | {
      type: 'jsx';
      data: {
        source: JsxChildren;
        metadata: Metadata;
      };
    };

/**
 * @deprecated This type is deprecated and will be removed in a future version.
 */
export type Request =
  | {
      type: 'content';
      data: {
        source: _Content;
        targetLocale: string;
        metadata: Metadata;
      };
    }
  | {
      type: 'jsx';
      data: {
        source: JsxChildren;
        targetLocale: string;
        metadata: Metadata;
      };
    };

/**
 * @deprecated Use {@link TranslationResult} instead.
 */
export type ContentTranslationResult = {
  translation: _Content;
  locale: string;
  reference?: {
    id: string;
    key: string;
  };
};

/**
 * @deprecated Use {@link TranslationResult} instead.
 */
export type IcuTranslationResult = {
  translation: string;
  locale: string;
  reference?: {
    id: string;
    key: string;
  };
};

/**
 * @deprecated Use {@link TranslationResult} instead.
 */
export type JsxTranslationResult = {
  translation: JsxChildren;
  locale: string;
  reference?: {
    id: string;
    key: string;
  };
};

export type { CustomMapping } from './locales/customLocaleMapping';

/**
 * Configures a translation request.
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
