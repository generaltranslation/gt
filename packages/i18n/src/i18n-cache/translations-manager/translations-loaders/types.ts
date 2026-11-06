import type { Content } from '@generaltranslation/format/types';
import { Hash } from '../TranslationsCache';

/**
 * Translations loader function type
 */
export type TranslationsLoader = (locale: string) => Promise<unknown>;

/**
 * Safe translations loader function type
 * @returns A promise that resolves to a mapping of strings to {@link Translation}
 */
export type SafeTranslationsLoader<T extends Content> = (
  locale: string
) => Promise<Record<Hash, T>>;
