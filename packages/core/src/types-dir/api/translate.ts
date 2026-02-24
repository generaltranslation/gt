import {
  I18nextMessage,
  IcuMessage,
  JsxChildren,
  StringMessage,
} from '../jsx/content';

/**
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
      translation: I18nextMessage | IcuMessage | StringMessage;
      dataFormat: 'ICU' | 'I18NEXT' | 'DATE_FNS' | 'STRING';
    };

/**
 * RequestError is a type that represents an error that occurred during a translation request.
 */
export type TranslationError = {
  error: string;
  code: number;
};

/**
 * RequestSuccess is a type that represents a successful translation request.
 */
export type RequestSuccess = TypedResult & {
  locale: string;
};

export type TranslationResult = RequestSuccess | TranslationError;
