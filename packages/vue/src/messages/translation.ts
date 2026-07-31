import { hashSource } from 'generaltranslation/id';
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
