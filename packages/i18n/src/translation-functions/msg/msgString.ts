import type { GTTranslationOptions } from '../types/options';
import type { RegisterableMessages } from '../types/message';
import { hashSource } from 'generaltranslation/id';
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
  const $_hash =
    stringOptions.$_hash ??
    hashSource({
      source: message,
      context: stringOptions.$context,
      maxChars: stringOptions.$maxChars,
      requiresReview: stringOptions.$requiresReview,
      dataFormat: 'STRING',
    });
  return encodeMsg(message, {
    ...stringOptions,
    $_hash,
    $_source: message,
  });
}
