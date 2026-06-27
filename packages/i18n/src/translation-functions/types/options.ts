import type {
  DataFormat,
  StringFormat,
} from '@generaltranslation/format/types';

type Variables = Record<string, unknown>;

/**
 * Reserved translation options. All other keys are user interpolation variables.
 */
export type ReservedTranslationOptions<F extends DataFormat = StringFormat> = {
  $context?: string;
  $id?: string;
  /** The data format for the message (e.g., 'ICU', 'STRING'). Defaults to 'ICU'. */
  $format?: F;
  /** The locale to use for formatting the message. */
  $locale?: string;
  $maxChars?: number;
  /** Precomputed message hash. */
  $_hash?: string;
  /** Original source message carried through msg() encoding. */
  $_source?: string;
  /** Original source carried while rendering a translation. */
  $_fallback?: string;
};

/**
 * Everything an inline translation function (gt, m, t, msg) accepts: reserved
 * options plus user interpolation variables. JSX options are metadata-only
 * because JSX interpolates through children rather than option variables.
 */
export type TranslationOptions<F extends DataFormat = StringFormat> =
  F extends 'JSX'
    ? ReservedTranslationOptions<F>
    : ReservedTranslationOptions<F> & Variables;

// For t()
export type DictionaryTranslationOptions = Variables;

export type DictionaryEntryOptions = Pick<
  ReservedTranslationOptions,
  '$format' | '$context' | '$maxChars'
> &
  Variables;

/**
 * The encoded form produced by msg() and read back by decode: a
 * TranslationOptions with the internal hash + source guaranteed present.
 */
export type EncodedTranslationOptions = TranslationOptions & {
  $_hash: string;
  $_source: string;
};

/**
 * Options for JSX translation
 * Used by the resolveJsxTranslation() function
 */
export type JsxTranslationOptions = Pick<
  ReservedTranslationOptions<'JSX'>,
  '$format' | '$context' | '$id' | '$_hash'
>;

/**
 * Lookup options after core has applied a default format.
 */
export type LookupOptions<F extends DataFormat = DataFormat> =
  TranslationOptions<F> & {
    $format: F;
  };

/**
 * Lookup options after core has applied defaults for locale and format.
 */
export type NormalizedLookupOptions<T extends DataFormat> = LookupOptions<T> & {
  $locale: string;
};
