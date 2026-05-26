import { Translation } from '../utils/types/translation-data';
import { Hash } from '../TranslationsCache';

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
) => Promise<Record<Hash, T>>;
