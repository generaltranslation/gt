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
  const translation = state.lookupTranslation(
    {
      $format: 'STRING',
      $_hash: hashStringMessage(message, options),
      ...(options.$context && { $context: options.$context }),
    },
    () => message
  );
  return typeof translation === 'string' ? translation : message;
}
