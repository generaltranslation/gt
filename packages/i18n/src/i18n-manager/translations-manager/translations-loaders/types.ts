import { Translation, Translations } from '../utils/types/translation-data';

/**
 * Translations loader function type
 */
export type TranslationsLoader = (locale: string) => Promise<unknown>;

/**
 * Safe translations loader function type
 * @returns A promise that resolves to a mapping of strings to {@link Translation}
 */
export type SafeTranslationsLoader<T extends Translation> = (
  locale: string
) => Promise<Translations<T>>;
