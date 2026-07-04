import type {
  DataFormat,
  StringFormat,
} from '@generaltranslation/format/types';

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
  /** @internal Used to carry the original source when rendering a translation */
  $_fallback?: string;
  /** @deprecated use {@link EncodedTranslationOptions} instead */
  $_source?: string;
  $maxChars?: number;
};

/**
 * Full internal option shape for string lookup and interpolation.
 */
export type TranslationOptions = TranslationVariables & TranslationMetadata;

/**
 * User-provided options accepted by gt().
 *
 * interp vars + $context, $id, $format, $locale, $_hash, $maxChars
 */
export type GTTranslationOptions = TranslationVariables &
  Pick<
    TranslationMetadata,
    | '$context'
    | '$id'
    | '$format'
    | '$locale'
    | '$_hash'
    | '$maxChars'
    | '$requiresReview'
  >;

export type DictionaryEntryOptions = TranslationVariables &
  Pick<TranslationMetadata, '$context' | '$format' | '$maxChars'>;

export type DictionaryLookupOptions = DictionaryEntryOptions & {
  $format: StringFormat;
};

/**
 * Options for string registration
 * Used by the msg() function
 */
export type EncodedTranslationOptions = GTTranslationOptions & {
  $_hash: string;
  $_source: string;
};

/**
 * Options for runtime translation
 * Used by the tx() function
 */
export type RuntimeTranslationOptions = TranslationVariables &
  Omit<TranslationMetadata, '$id' | '$format'> & {
    $format?: DataFormat;
  };

/**
 * Options for JSX translation
 * Used by the resolveJsx() function
 */
export type JsxTranslationOptions = Pick<
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
  | (JsxTranslationOptions & {
      $format: 'JSX';
      $locale?: string;
    });

export type LookupOptionsFor<T extends DataFormat> = T extends 'JSX'
  ? JsxTranslationOptions & {
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
