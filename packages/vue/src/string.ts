import { hashSource } from 'generaltranslation/id';
import { decode, encode } from 'generaltranslation/internal';
import { useGTState } from './state';
import type {
  GTFunction,
  GTState,
  GTStringOptions,
  MessagesFunction,
} from './types';

type InternalStringOptions = GTStringOptions & {
  /** @internal Compile-time hash inserted by GT tooling. */
  $_hash?: string;
};

function translateString(
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

export function useGT(): GTFunction {
  const state = useGTState();
  return (message, options = {}) =>
    translateString(state, message, options as InternalStringOptions);
}

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

export function msg<T extends string | string[]>(message: T): T;
export function msg<T extends string | string[]>(
  message: T,
  options?: GTStringOptions
): T;
export function msg(
  message: string | string[],
  options?: GTStringOptions
): string | string[] {
  if (Array.isArray(message)) {
    return message.map((entry) => msg(entry, options));
  }
  if (!options) return message;

  const $_hash = hashSource({
    context: options.$context,
    dataFormat: 'STRING',
    source: message,
  });
  const encoded = encode(
    JSON.stringify({
      ...options,
      $_hash,
      $_source: message,
    })
  );
  return `${message}:${encoded}`;
}

function decodeMessageOptions(message: string):
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
