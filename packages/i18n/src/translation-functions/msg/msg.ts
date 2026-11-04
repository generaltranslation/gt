import type {
  EncodedTranslationOptions,
  GTTranslationOptions,
} from '../types/options';
import { formatMessage } from '@generaltranslation/format';
import {
  libraryDefaultLocale,
  VAR_IDENTIFIER,
} from 'generaltranslation/internal';
import { createInterpolationFailureMessage } from '../utils/messages';
import logger from '../../logs/logger';
import { extractVariables } from '../../utils/extractVariables';
import { hashMessage } from '../../utils/hashMessage';
import { RegisterableMessages } from '../types/message';
import { encodeMsg } from './encodeMsg';
import { msgString } from './msgString';
import {
  type MsgInlineTranslations,
  type InlineTranslations,
  getInlineArrayElement,
  registerInlineTranslations,
} from '../inline/inlineTranslations';

/**
 * Registers a message to be translated. Returns the message unchanged if no options are provided.
 * @param {string | string[]} message The message to encode.
 * @param {GTTranslationOptions} [options] The options to encode.
 * @returns The message or array of messages.
 *
 * @note - This function registers the message before the build process. The actual translation does not
 * occur until the m() function is invoked.
 *
 * @note - Message format
 * A message is broken into two parts separated by colons:
 * - interpolated content - the content with interpolated variables
 * - hash + options - a unique identifier for the source content and options for the translation
 *
 * @example - Basic usage
 *
 * const message1 = msg('Hello, World!');
 * console.log(message1); // "Hello, World!"
 *
 * const message2 = msg('Hello, {name}!', { name: 'Brian' });
 * console.log(message2); // "Hello, Brian:eyIkX2hhc2giOiAiMHgxMjMiLCAiJF9zb3VyY2UiOiAiSGVsbG8sIHtuYW1lfSEiLCAibmFtZSI6ICJCcmlhbiJ9"
 *
 * @example - Array usage
 *
 * const messages = msg(['Hello, Alice!', 'Hello, Bob!']);
 * console.log(messages); // ["Hello, Alice!", "Hello, Bob!"]
 *
 * @example - When specifying an id for an array, each message will have a unique id of `${id}.${index}`
 * const messages = msg(['Hello, Alice!', 'Hello, Bob!'], { $id: 'greetings' });
 * // "Hello, Alice!" id: "greetings.0"
 * // "Hello, Bob!" id: "greetings.1"
 *
 * @example - Inline translations (usually injected at build time)
 * // Registers the embedded translations under the message hash so m() can
 * // resolve them without loading the locale's translations.
 * const message = msg('Hello', undefined, (locale) =>
 *   locale === 'fr' ? 'Bonjour' : undefined
 * );
 *
 * @note - Passing inline translations makes msg() impure: it registers them in
 * a module-level registry keyed by the message hash. For arrays, the callback
 * returns one translation per element, and each element registers separately.
 *
 * @important Internal note: until other packages are updated to use i18n-context practices, msg cannot use any functions that use i18nCache at all!
 */
export function msg<T extends RegisterableMessages = string>(message: T): T;
export function msg<T extends RegisterableMessages = string>(
  message: T,
  options?: GTTranslationOptions,
  inline?: MsgInlineTranslations
): T extends string ? string : string[];
export function msg(
  message: RegisterableMessages,
  options?: GTTranslationOptions,
  inline?: MsgInlineTranslations
): RegisterableMessages {
  if (options?.$format === 'STRING') {
    return msgString(message, options, inline);
  }

  // Register inline translations so m() can resolve them by hash
  if (inline && typeof message === 'string') {
    registerInlineTranslations(
      options?.$_hash ||
        hashMessage(message, {
          $format: 'ICU',
          ...options,
        }),
      inline as InlineTranslations<string>
    );
  }

  // Handle array
  if (typeof message !== 'string') {
    if (!options && !inline) return message;
    return message.map((m, i) =>
      msg(
        m,
        options && {
          ...options,
          // ignore if $id is an empty string or not defined
          ...(options.$id && { $id: `${options.$id}.${i}` }),
        },
        getInlineArrayElement(inline, i)
      )
    );
  }

  if (!options) {
    return message;
  }

  const variables = extractVariables(options);
  let interpolatedString: string;
  try {
    interpolatedString = formatMessage(message, {
      locales: [libraryDefaultLocale], // TODO: use compiler to insert locales
      variables: {
        ...variables,
        [VAR_IDENTIFIER]: 'other',
      },
    });
  } catch {
    logger.warn(createInterpolationFailureMessage(message));
    return message;
  }

  // Encode options
  const $_source = message;
  const $_hash =
    options.$_hash ||
    hashMessage(message, {
      $format: 'ICU',
      ...options,
    });

  const encodedOptions: EncodedTranslationOptions = {
    ...options,
    $_source,
    $_hash,
  };
  return encodeMsg(interpolatedString, encodedOptions);
}
