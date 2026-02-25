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
  locale?: string;
} & Omit<InlineTranslationOptions, 'id'>;
