import type { ErrorCode } from '@generaltranslation/api';
import {
  I18nextMessage,
  IcuMessage,
  JsxChildren,
  StringMessage,
} from '@generaltranslation/format/types';

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
 * A translation that failed. `code` is the API's error code; new codes may appear.
 */
export type TranslationError = {
  success: false;
  error: string;
  code: ErrorCode | (string & {});
};

/**
 * RequestSuccess is a type that represents a successful translation request.
 */
export type RequestSuccess = TypedResult & {
  success: true;
  locale: string;
};

export type TranslationResult = RequestSuccess | TranslationError;
