// ========== Translation Data Types ========== //
// TODO: reduce duplication between this file and packages/react-core/src/types-dir/types.ts

/**
 * A single string translation
 * Unknown represents JSX translations which are out of scope for the `gt-i18n` package
 */
export type Translation = string | unknown;

/**
 * Object containing translations for a single locale
 */
export type Translations = {
  [hash: string]: Translations;
};

/**
 * A mapping between locales and their {@link Translations} objects along with an expiry timestamp
 * @typedef {Object} TranslationsMapEntry
 * @property {Promise<Translations>} promise - The promise for the translations object.
 * @property {number} expiresAt - The timestamp when the translations will expire.
 */
export type TranslationsMap = Map<
  string,
  {
    promise: Promise<Translations>;
    expiresAt: number;
  }
>;
