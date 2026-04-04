// ========== Translation Data Types ========== //
// TODO: reduce duplication between this file and packages/react-core/src/types-dir/types.ts

import { Content } from 'generaltranslation/types';

/**
 * A single string translation
 * TODO: remove this type and use Content everywhere instead
 */
export type Translation = Content;

/**
 * Object containing translations for a single locale
 * TODO: when done, make the generic default to Translation
 */
export type Translations<T extends Translation | unknown = Translation> = {
  [hash: string]: T;
};

/**
 * A mapping between locales and their {@link Translations} objects along with an expiry timestamp
 * @typedef {Object} TranslationsMapEntry
 * @property {Promise<Translations>} promise - The promise for the translations object.
 * @property {number} expiresAt - The timestamp when the translations will expire.
 */
export type TranslationsMap<T extends Translation> = Map<
  string,
  {
    promise: Promise<Translations<T>>;
    expiresAt: number;
  }
>;

/**
 * A mapping between locales and their {@link Translations} objects
 * Maps locale to translations object
 */
export type ResolvedTranslationsMap<T extends Translation> = Map<
  string,
  Translations<T>
>;
