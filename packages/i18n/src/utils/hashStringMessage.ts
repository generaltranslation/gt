import { hashSource } from 'generaltranslation/id';
import type { GTTranslationOptions } from '../translation-functions/types/options';

/** Hashes a literal STRING message and its supported lookup metadata. */
export function hashStringMessage(
  message: string,
  options: GTTranslationOptions = {}
): string {
  if (options.$_hash != null) return options.$_hash;

  return hashSource({
    source: message,
    ...(options.$context && { context: options.$context }),
    ...(options.$maxChars != null && {
      maxChars: Math.abs(options.$maxChars),
    }),
    ...(options.$requiresReview === true && { requiresReview: true }),
    dataFormat: 'STRING',
  });
}
