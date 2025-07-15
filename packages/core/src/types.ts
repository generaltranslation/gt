import { LocaleProperties } from './locales/getLocaleProperties';

import { Variable, VariableType } from './types-dir/variables';

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
} from './types-dir/content';
import { ActionType, EntryMetadata, Entry } from './types-dir/entry';

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
} from './types-dir/checkFileTranslations';
export type {
  DownloadFileBatchOptions,
  DownloadFileBatchResult,
} from './types-dir/downloadFileBatch';
export type {
  FetchTranslationsOptions,
  FetchTranslationsResult,
  RetrievedTranslations,
} from './types-dir/fetchTranslations';
export type {
  EnqueueFilesOptions,
  EnqueueFilesResult,
  FileToTranslate,
  Updates,
} from './types-dir/enqueueFiles';
export type {
  EnqueueEntriesOptions,
  EnqueueEntriesResult,
} from './types-dir/enqueueEntries';
export type { DownloadFileOptions } from './types-dir/downloadFile';
export type {
  FileFormat,
  CompletedFileTranslationData,
} from './types-dir/file';
export type { TranslateManyResult } from './types-dir/translateMany';
export type { TranslationResult } from './types-dir/translate';

/**
 * @deprecated Use {@link Content} instead.
 */
export type _Content = string | Array<string | Variable>;

/**
 * Transformations are made from a prefix and a suffix.
 */
export type Transformation =
  | 'translate-client'
  | 'translate-server'
  | 'translate-runtime'
  | 'variable-variable'
  | 'variable-currency'
  | 'variable-datetime'
  | 'variable-number'
  | 'plural'
  | 'branch';
export type TransformationPrefix =
  | 'translate'
  | 'variable'
  | 'plural'
  | 'branch'
  | 'fragment';
export type VariableTransformationSuffix =
  | 'variable'
  | 'number'
  | 'datetime'
  | 'currency';

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

export type ContentTranslationResult = {
  translation: _Content;
  locale: string;
  reference?: {
    id: string;
    key: string;
  };
};

export type IcuTranslationResult = {
  translation: string;
  locale: string;
  reference?: {
    id: string;
    key: string;
  };
};

export type JsxTranslationResult = {
  translation: JsxChildren;
  locale: string;
  reference?: {
    id: string;
    key: string;
  };
};

export type TranslationError = {
  error?: string;
  code?: number;
  reference?: {
    id: string;
    hash: string;
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
