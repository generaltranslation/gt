import { msgString as registerMessage } from 'gt-i18n/internal/string';
import type { GTStringOptions } from '../types';

/**
 * Registers one or more static strings for extraction and later resolution by
 * {@link useMessages}. This function does not perform a translation lookup.
 *
 * With no options, the original string or array is returned unchanged. When an
 * options object is supplied, `msg` appends opaque STRING lookup metadata
 * while preserving the source text literally; it performs no ICU processing
 * or interpolation.
 *
 * @param message - Static source string or readonly array of static strings.
 * @param options - Optional context used to disambiguate the source hash.
 * @returns The original input when no options are supplied, otherwise an
 * encoded string or array of encoded strings.
 *
 * @example
 * ```ts
 * const saved = msg('Your preferences are saved.', {
 *   $context: 'status message',
 * });
 * ```
 */
export function msg<T extends string | readonly string[]>(message: T): T;
export function msg<T extends string | readonly string[]>(
  message: T,
  options?: GTStringOptions
): T extends string ? string : string[];
export function msg(
  message: string | readonly string[],
  options?: GTStringOptions
): string | readonly string[] {
  return registerMessage(message, options);
}
