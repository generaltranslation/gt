import type { DataFormat, StringFormat } from '@generaltranslation/format';

/**
 * Values that get interpolated
 * Used as t() options because dictionary metadata comes from the dictionary leaf.
 */
export type TranslationVariables = Record<string, unknown>;

export type TranslationMetadata = {
  $context?: string;
  $id?: string;
  /** The data format for the message (e.g., 'ICU', 'STRING'). Defaults to 'ICU'. */
  $format?: StringFormat;
  /** The locale to use for formatting the message. */
  $locale?: string;
  $_hash?: string;
  /** Whether the translated message requires approval before use. Must be a boolean literal. */
  $requiresReview?: boolean;
  $maxChars?: number;
};

/**
 * Full internal option shape for string lookup and interpolation.
 */
export type TranslationOptions = TranslationVariables & TranslationMetadata;

/**
 * Options for JSX translation
 */
export type JsxLookupOptions = Pick<
  TranslationMetadata,
  '$context' | '$id' | '$_hash'
> & {
  // TODO: make this required, but internally, not user facing
  $format?: 'JSX';
  $maxChars?: number;
  /** Whether the translated content requires approval before use */
  $requiresReview?: boolean;
};

/**
 * Resolution options - options needed to perform a resolution for a given content
 */
export type LookupOptions =
  | (TranslationOptions & {
      $format: StringFormat;
    })
  | (JsxLookupOptions & {
      $format: 'JSX';
      $locale?: string;
    })
  | (Pick<
      TranslationMetadata,
      '$context' | '$locale' | '$_hash' | '$maxChars' | '$requiresReview'
    > & {
      $format: 'MESSAGE_TREE';
    });

export type LookupOptionsFor<T extends DataFormat> = T extends 'JSX'
  ? JsxLookupOptions & {
      /**
       * The locale to use for formatting looking up and formatting the message.
       */
      $locale?: string;
      $format?: 'JSX';
    }
  : TranslationOptions & {
      $format?: T;
    };

/**
 * Lookup options after core has applied defaults for locale and format.
 */
export type NormalizedLookupOptions<T extends DataFormat> =
  LookupOptionsFor<T> & {
    $format: T;
    $locale: string;
  };
