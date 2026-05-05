import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { LookupOptions } from '../translation-functions/types/options';
import { Translation } from '../types';
import type { IcuMessage } from 'generaltranslation/types';

/**
 * Hash a message string
 */
export function hashMessage<T extends Translation>(
  message: T,
  options: LookupOptions
): string {
  if (options.$_hash != null) {
    return options.$_hash;
  }

  return hashSource({
    source:
      options.$format === 'ICU' ? indexVars(message as IcuMessage) : message,
    ...(options?.$context && { context: options.$context }),
    ...(options?.$id && { id: options.$id }),
    ...('$maxChars' in options &&
      options.$maxChars != null && {
        maxChars: Math.abs(options.$maxChars),
      }),
    dataFormat: options.$format,
  });
}
