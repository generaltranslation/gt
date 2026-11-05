import { indexVars } from 'generaltranslation/internal';
import type { Content, IcuMessage } from '@generaltranslation/format/types';
import type { LookupOptions } from '../translation-functions/types/options';
import { hashMessageSource, needsIcuIndexing } from './hashMessage';

/**
 * Hash a message like {@link hashMessage}, indexing ICU `_gt_` variables
 * first. Only legacy ICU code imports this, because indexVars loads the ICU
 * parser.
 */
export function hashIcuMessage<T extends Content>(
  message: T,
  options: LookupOptions
): string {
  if (options.$_hash != null) return options.$_hash;
  return hashMessageSource(
    options.$format === 'ICU' ? indexVars(message as IcuMessage) : message,
    options
  );
}

/**
 * Returns the lookup options with `$_hash` set when the ICU message needs
 * indexing, so the parser-free hashMessage used by caches and listeners
 * produces the legacy hash.
 */
export function withIcuHash<O extends LookupOptions>(
  message: Content,
  options: O
): O {
  if (options.$_hash != null || !needsIcuIndexing(message, options)) {
    return options;
  }
  try {
    return { ...options, $_hash: hashIcuMessage(message, options) };
  } catch {
    // Malformed ICU cannot be indexed; hash it as written so the lookup
    // misses and formatting reports it, as it did before indexing moved here.
    return { ...options, $_hash: hashMessageSource(message, options) };
  }
}
