import {
  I18nextMessage,
  IcuMessage,
  JsxChildren,
  DateFnsMessage,
} from '../jsx/content';

/**\
 * TranslationResultReference is used to store the reference for a translation result.
 */
export type TranslationResultReference = {
  id?: string;
  hash: string;
};

/**
 * TypedResult is a union type that represents the different types of translations that can be returned.
 */
export type TypedResult =
  | {
      translation: JsxChildren;
      dataFormat: 'JSX';
    }
  | {
      translation: I18nextMessage | IcuMessage | DateFnsMessage;
      dataFormat: 'ICU' | 'I18NEXT' | 'DATE_FNS';
    };

/**
 * RequestError is a type that represents an error that occurred during a translation request.
 */
export type TranslationError = {
  error: string;
  code: number;
  reference?: TranslationResultReference;
};

/**
 * RequestSuccess is a type that represents a successful translation request.
 */
export type RequestSuccess = TypedResult & {
  locale: string;
  reference: TranslationResultReference;
};

export type TranslationResult = RequestSuccess | TranslationError;
