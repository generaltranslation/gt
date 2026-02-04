// TODO: next major version, this should be Record<string, string>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseTranslationOptions = Record<string, any>;

// For t()
export type DictionaryTranslationOptions = BaseTranslationOptions;

// For functions like gt(), msg()
export type InlineTranslationOptions = BaseTranslationOptions & {
  $context?: string;
  $id?: string;
  $_hash?: string;
  $maxChars?: number;
  /** @deprecated use {@link EncodedTranslationOptions} instead */
  $_source?: string;
};

// For functions like m()
export type InlineResolveOptions = BaseTranslationOptions;

/**
 * Options generated and encoded by msg()
 * @internal
 */
export type EncodedTranslationOptions = BaseTranslationOptions & {
  $context?: string;
  $id?: string;
  $maxChars?: number;
  $_hash: string;
  $_source: string;
};

// For tx()
export type RuntimeTranslationOptions = {
  locale?: string;
} & Omit<InlineTranslationOptions, 'id'>;

// TODO: also export this from fallbacks
// TODO: next major version, this should be <T extends string | null | undefined>(message: T, options?: InlineTranslationOptions) => T extends string ? string : T;
export type MFunctionType = <T extends string | null | undefined>(
  encodedMsg: T,
  // TODO: this needs to become a InlineTranslationOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: Record<string, any>
) => T extends string ? string : T;

// TODO: also export this from fallbacks
// TODO: next major version, this should be <T extends string | null | undefined>(message: T, options?: InlineTranslationOptions) => T extends string ? string : T;
export type GTFunctionType = (
  message: string,
  options?: InlineTranslationOptions
) => string;
