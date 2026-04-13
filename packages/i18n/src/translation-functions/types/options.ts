import { Content, StringFormat } from 'generaltranslation/types';

// TODO: next major version, this should be Record<string, string>
export type BaseTranslationOptions = Record<string, any>;

// For t()
export type DictionaryTranslationOptions = BaseTranslationOptions;

/**
 * Options for string resolution
 * Used by the gt() function
 */
export type InlineTranslationOptions = BaseTranslationOptions & {
  $context?: string;
  $id?: string;
  /** The data format for the message (e.g., 'ICU', 'STRING'). Defaults to 'ICU'. */
  $format?: StringFormat;
  /** The locale to use for formatting the message. Defaults to the current locale. Determines the formatting behavior. */
  $locale?: string;
  /**
   * @deprecated use {@link $locale} instead
   */
  $_locales?: string | string[];
  $_hash?: string;
  $maxChars?: number;
  /** @internal Used to carry the original source when rendering a translation */
  $_fallback?: string;
  /** @deprecated use {@link EncodedTranslationOptions} instead */
  $_source?: string;
};

/**
 * Options for string resolution
 * Used by the m() function
 */
export type InlineResolveOptions = BaseTranslationOptions;

/**
 * Options for string registration
 * Used by the msg() function
 */
export type EncodedTranslationOptions = BaseTranslationOptions & {
  $context?: string;
  $id?: string;
  $maxChars?: number;
  $_hash: string;
  $_source: string;
};

/**
 * Options for runtime translation
 * Used by the tx() function
 */
export type RuntimeTranslationOptions = {
  $locale?: string;
} & Omit<InlineTranslationOptions, 'id'>;

/**
 * Options for JSX translation
 * Used by the resolveJsxTranslation() function
 */
export type JsxTranslationOptions = {
  $context?: string;
  $id?: string;
};

/**
 * Resolution options - options needed to perform a resolution for a given content
 */
export type ResolutionOptions =
  | (Omit<InlineTranslationOptions, '$format'> & {
      $format: StringFormat;
      $locale?: string;
    })
  | (RuntimeTranslationOptions & {
      $format: Content;
    })
  | (JsxTranslationOptions & {
      $format: 'JSX';
      $locale?: string;
    });
