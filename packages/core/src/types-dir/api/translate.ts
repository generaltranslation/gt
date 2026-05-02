import {
  I18nextMessage,
  IcuMessage,
  JsxChildren,
  StringMessage,
} from '../jsx/content';

/**
 * Stores the reference for a translation result.
 */
export type TranslationResultReference = {
  id?: string;
  hash: string;
};

/**
 * Represents the different translation payload types that can be returned.
 */
export type TypedResult =
  | {
      // TODO: Verify whether translated JSX elements can omit the tag name (`t`).
      translation: JsxChildren;
      dataFormat: 'JSX';
    }
  | {
      translation: I18nextMessage | IcuMessage | StringMessage;
      dataFormat: 'ICU' | 'I18NEXT' | 'STRING';
    };

/**
 * Represents an error that occurred during a translation request.
 */
export type TranslationError = {
  success: false;
  error: string;
  code: number;
};

/**
 * Represents a successful translation request.
 */
export type RequestSuccess = TypedResult & {
  success: true;
  locale: string;
};

export type TranslationResult = RequestSuccess | TranslationError;
