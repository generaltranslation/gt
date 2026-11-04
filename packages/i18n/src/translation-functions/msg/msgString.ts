import type { GTTranslationOptions } from '../types/options';
import type { RegisterableMessages } from '../types/message';
import { hashStringMessage } from '../../utils/hashStringMessage';
import { encodeMsg } from './encodeMsg';
import {
  type MsgInlineTranslations,
  type InlineTranslations,
  getInlineArrayElement,
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
  inline?: MsgInlineTranslations
): T extends string ? string : string[];
export function msgString(
  message: RegisterableMessages,
  options?: GTTranslationOptions,
  inline?: MsgInlineTranslations
): RegisterableMessages {
  if (typeof message !== 'string') {
    if (!options && !inline) return message;
    return message.map((entry, index) =>
      msgString(
        entry,
        options && {
          ...options,
          ...(options.$id && { $id: `${options.$id}.${index}` }),
        },
        getInlineArrayElement(inline, index)
      )
    );
  }
  if (!options && !inline) return message;

  const stringOptions = { ...options, $format: 'STRING' as const };
  const $_hash = hashStringMessage(message, stringOptions);

  // Register inline translations so m() can resolve them by hash
  if (inline) {
    registerInlineTranslations($_hash, inline as InlineTranslations<string>);
  }

  if (!options) return message;
  return encodeMsg(message, {
    ...stringOptions,
    $_hash,
    $_source: message,
  });
}
