import {
  decodeMessageOptions,
  translateString,
  type InternalStringOptions,
} from '../messages/translation';
import { useGTState } from '../runtime/state';
import type { GTFunction, GTStringOptions, MessagesFunction } from '../types';

/**
 * Returns a synchronous plain-string translation function for the active GT
 * plugin.
 *
 * `$context` is the only supported option. Braces remain literal and no ICU
 * formatting or interpolation is applied. Missing entries return the source
 * string. Call the returned function from a render, computed value, or
 * reactive effect when the result should update with locale/catalog changes.
 *
 * @returns A synchronous STRING catalog lookup function.
 */
export function useGT(): GTFunction {
  const state = useGTState();
  return (message, options = {}) =>
    translateString(state, message, options as InternalStringOptions);
}

/**
 * Returns a synchronous resolver for values registered with {@link msg} and
 * for ordinary source strings.
 *
 * Encoded `msg` metadata takes precedence over call-site options. Raw strings
 * may supply `$context`; null and undefined are returned unchanged. Missing
 * entries fall back to the source text, with no ICU formatting or
 * interpolation. Call the resolver from a render, computed value, or reactive
 * effect when the result should update with locale/catalog changes.
 *
 * @returns A resolver for registered messages and raw strings.
 */
export function useMessages(): MessagesFunction {
  const state = useGTState();
  return (<T extends string | null | undefined>(
    message: T,
    options: GTStringOptions = {}
  ): T extends string ? string : T => {
    if (message == null) return message as T extends string ? string : T;

    const decoded = decodeMessageOptions(message);
    if (
      decoded &&
      typeof decoded.$_source === 'string' &&
      typeof decoded.$_hash === 'string'
    ) {
      return translateString(state, decoded.$_source, {
        $context: decoded.$context,
        $_hash: decoded.$_hash,
      }) as T extends string ? string : T;
    }

    return translateString(state, message, options) as T extends string
      ? string
      : T;
  }) as MessagesFunction;
}
