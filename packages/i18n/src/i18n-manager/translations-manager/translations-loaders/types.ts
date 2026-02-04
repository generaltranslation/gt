// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
import { defaultCacheUrl } from 'generaltranslation/internal';
import { Translations } from '../utils/types/translation-data';

/**
 * Translations loader function type
 */
export type TranslationsLoader = (locale: string) => Promise<unknown>;

/**
 * Safe translations loader function type
 * @returns A promise that resolves to a mapping of strings to {@link Translation}
 */
export type SafeTranslationsLoader = (locale: string) => Promise<Translations>;
