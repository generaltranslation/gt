import { encode } from 'generaltranslation/internal';
import type { EncodedTranslationOptions } from './types';

/** Encodes message metadata for later resolution by an `m` function. */
export function encodeMsg(
  message: string,
  options: EncodedTranslationOptions
): string {
  return `${message}:${encode(JSON.stringify(options))}`;
}
