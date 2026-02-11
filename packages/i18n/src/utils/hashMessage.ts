import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { InlineTranslationOptions } from '../translation-functions/types/options';

/**
 * Hash a message string
 */
export function hashMessage(
  message: string,
  options?: InlineTranslationOptions
): string {
  return hashSource({
    source: indexVars(message),
    ...(options?.$context && { context: options.$context }),
    ...(options?.$id && { id: options.$id }),
    ...(options?.$maxChars != null && {
      maxChars: Math.abs(options.$maxChars),
    }),
    dataFormat: 'ICU',
  });
}
