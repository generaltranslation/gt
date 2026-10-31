import type { ContentFor, DataFormat } from '@generaltranslation/format/types';

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
// TODO: omit the t property (tag name) from translated JSX elements
export type TypedResult = {
  [Format in DataFormat]: {
    translation: ContentFor<Format>;
    dataFormat: Format;
  };
}[DataFormat];

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
