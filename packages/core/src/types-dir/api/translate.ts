import type { ErrorCode } from '@generaltranslation/api';
import type { ContentFor, DataFormat } from '@generaltranslation/format/types';

/**
 * TypedResult is a union type that represents the different types of translations that can be returned.
 */
// TODO: omit the t property (tag name) from translated JSX elements
export type TypedResult = {
  [Format in DataFormat]: {
    translation: ContentFor<Format>;
    dataFormat: Format;
  };
}[DataFormat];

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
