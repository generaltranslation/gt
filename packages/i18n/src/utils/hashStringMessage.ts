import { hashSource } from 'generaltranslation/id';
import type { GTTranslationOptions } from '../translation-functions/types/options';

/**
 * Calculates the canonical lookup hash for a literal STRING message.
 *
 * Keeping STRING metadata normalization in this dependency-light helper lets
 * framework runtimes share the same persisted catalog-key contract without
 * importing the ICU message parser used by {@link hashMessage}.
 *
 * @param message - Literal source text. Braces are not interpreted.
 * @param options - Optional precomputed hash and source metadata.
 * @returns The precomputed hash when present, otherwise the canonical hash.
 */
export function hashStringMessage(
  message: string,
  options: GTTranslationOptions = {}
): string {
  if (options.$_hash != null) return options.$_hash;

  return hashSource({
    context: options.$context,
    dataFormat: 'STRING',
    maxChars: options.$maxChars,
    requiresReview: options.$requiresReview,
    source: message,
  });
}
