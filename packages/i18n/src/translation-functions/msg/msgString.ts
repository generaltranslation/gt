import type { GTTranslationOptions } from '../types/options';
import type { RegisterableMessages } from '../types/message';
import { hashStringMessage } from '../../utils/hashStringMessage';
import { encodeMsg } from './encodeMsg';

/**
 * Registers one or more literal STRING messages without applying ICU
 * interpolation.
 *
 * Framework integrations should narrow the options they expose in their
 * public API.
 */
export function msgString<T extends RegisterableMessages = string>(
  message: T
): T;
export function msgString<T extends RegisterableMessages = string>(
  message: T,
  options?: GTTranslationOptions
): T extends string ? string : string[];
export function msgString(
  message: RegisterableMessages,
  options?: GTTranslationOptions
): RegisterableMessages {
  if (typeof message !== 'string') {
    if (!options) return message;
    return message.map((entry, index) =>
      msgString(entry, {
        ...options,
        ...(options.$id && { $id: `${options.$id}.${index}` }),
      })
    );
  }
  if (!options) return message;

  const stringOptions = { ...options, $format: 'STRING' as const };
  return encodeMsg(message, {
    ...stringOptions,
    $_hash: hashStringMessage(message, stringOptions),
    $_source: message,
  });
}
