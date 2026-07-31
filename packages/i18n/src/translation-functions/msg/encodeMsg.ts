import { encode } from 'generaltranslation/internal';
import type { EncodedTranslationOptions } from '../types/options';

/** Encodes message metadata for later resolution by an `m` function. */
export function encodeMsg(
  message: string,
  options: EncodedTranslationOptions
): string {
  return `${message}:${encode(JSON.stringify(options))}`;
}
