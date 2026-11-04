import type { GTTranslationOptions } from '../types/options';
import type { RegisterableMessages } from '../types/message';
import { hashStringMessage } from '../../utils/hashStringMessage';
import { encodeMsg } from './encodeMsg';
import {
  type InlineTranslations,
  registerInlineTranslations,
} from '../inline/inlineTranslations';

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
  options?: GTTranslationOptions,
  inline?: InlineTranslations<string>
): T extends string ? string : string[];
export function msgString(
  message: RegisterableMessages,
  options?: GTTranslationOptions,
  inline?: InlineTranslations<string>
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
  if (!options && !inline) return message;

  const stringOptions = { ...options, $format: 'STRING' as const };
  const $_hash = hashStringMessage(message, stringOptions);

  // Register inline translations so m() can resolve them by hash
  if (inline) registerInlineTranslations($_hash, inline);

  if (!options) return message;
  return encodeMsg(message, {
    ...stringOptions,
    $_hash,
    $_source: message,
  });
}
