import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { ResolutionOptions } from '../translation-functions/types/options';
import { Translation } from '../types';

/**
 * Hash a message string
 */
export function hashMessage(
  message: Translation,
  options: ResolutionOptions
): string {
  return hashSource({
    source: options.$format === 'JSX' ? message : indexVars(message as string),
    ...(options?.$context && { context: options.$context }),
    ...(options?.$id && { id: options.$id }),
    ...('$maxChars' in options &&
      options.$maxChars != null && {
        $maxChars: Math.abs(options.$maxChars),
      }),
    dataFormat: options.$format,
  });
}
