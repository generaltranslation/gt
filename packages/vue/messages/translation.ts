import { hashSource } from 'generaltranslation/id';
import { decode } from 'generaltranslation/internal';
import type { GTState, GTStringOptions } from '../types';

/** @internal */
export type InternalStringOptions = GTStringOptions & {
  /** @internal Compile-time hash inserted by GT tooling. */
  $_hash?: string;
};

/** @internal */
export function translateString(
  state: GTState,
  message: string,
  options: InternalStringOptions = {}
): string {
  const hash =
    options.$_hash ??
    hashSource({
      context: options.$context,
      dataFormat: 'STRING',
      source: message,
    });
  const translation = state.getCatalog()[hash];
  return typeof translation === 'string' ? translation : message;
}

/** @internal */
export function decodeMessageOptions(message: string):
  | {
      $context?: string;
      $_hash: string;
      $_source: string;
    }
  | undefined {
  const separator = message.lastIndexOf(':');
  if (separator < 0) return undefined;

  try {
    const options = JSON.parse(decode(message.slice(separator + 1))) as Record<
      string,
      unknown
    >;
    if (
      typeof options.$_hash === 'string' &&
      typeof options.$_source === 'string'
    ) {
      return {
        ...(typeof options.$context === 'string' && {
          $context: options.$context,
        }),
        $_hash: options.$_hash,
        $_source: options.$_source,
      };
    }
  } catch {
    // A normal string may contain a colon. It is not an encoded message.
  }
  return undefined;
}
