import { LocaleProperties } from './locales/getLocaleProperties';

import { Variable, VariableType } from './types-dir/jsx/variables';

import {
  IcuMessage,
  I18nextMessage,
  JsxChildren,
  JsxChild,
  JsxElement,
  GTProp,
  HtmlContentPropKeysRecord,
  HtmlContentPropValuesRecord,
  HTML_CONTENT_PROPS,
  DataFormat,
  Content,
} from './types-dir/jsx/content';
import { ActionType, EntryMetadata, Entry } from './types-dir/api/entry';
export type { TranslationStatusResult } from './types-dir/api/translationStatus';

export {
  IcuMessage,
  I18nextMessage,
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
  EntryMetadata as EntryMetadata,
  Entry as Entry,
  Content,
};

export type {
  FileTranslationQuery,
  CheckFileTranslationsOptions,
  CheckFileTranslationsResult,
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
  FileToTranslate,
  Updates,
} from './types-dir/api/enqueueFiles';
export type {
  EnqueueEntriesOptions,
  EnqueueEntriesResult,
} from './types-dir/api/enqueueEntries';
export type { DownloadFileOptions } from './types-dir/api/downloadFile';
export type {
  FileFormat,
  CompletedFileTranslationData,
} from './types-dir/api/file';
export type { TranslateManyResult } from './types-dir/api/translateMany';
export type {
  TranslationResult,
  TranslationError,
  TranslationResultReference,
} from './types-dir/api/translate';

/**
 * @deprecated Use {@link Content} instead.
 */
export type _Content = string | Array<string | Variable>;

export type {
  Transformation,
  TransformationPrefix,
  VariableTransformationSuffix,
} from './types-dir/transformations';

export type Metadata = {
  context?: string;
  id?: string;
  sourceLocale?: string;
  actionType?: 'standard' | 'fast' | string;
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

// ----- VARIABLES ----- //

// ----- TRANSLATION REQUEST TYPES ----- //

/**
 * TranslationRequestConfig is used to configure the translation request.
 *
 * @param projectId - The project id of the translation request.
 * @param baseUrl - The base url of the translation request.
 * @param apiKey - The api key of the translation request.
 */
export type TranslationRequestConfig = {
  projectId: string;
  baseUrl?: string;
  apiKey?: string;
};
