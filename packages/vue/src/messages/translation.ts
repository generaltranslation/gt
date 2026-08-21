import { hashStringMessage } from 'gt-i18n/internal/string';
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
  const hash = hashStringMessage(message, options);
  const translation = state.getCatalog()[hash];
  return typeof translation === 'string' ? translation : message;
}
