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
      // TODO: omit the t property (tag name) from the translated element
      // I have to double check that this is the case, but I think it is
      translation: JsxChildren;
      dataFormat: 'JSX';
    }
  | {
      translation: I18nextMessage | IcuMessage | StringMessage;
      dataFormat: 'ICU' | 'I18NEXT' | 'STRING';
    };

/**
 * RequestError is a type that represents an error that occurred during a translation request.
 */
export type TranslationError = {
  success: false;
  error: string;
  code: number;
};

/**
 * RequestSuccess is a type that represents a successful translation request.
 */
export type RequestSuccess = TypedResult & {
  success: true;
  locale: string;
};

export type TranslationResult = RequestSuccess | TranslationError;
