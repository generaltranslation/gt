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
  getI18nConfig,
  isI18nConfigInitialized,
} from '../../i18n-config/singleton-operations';

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
 * @important Internal note: until other packages are updated to use i18n-context practices, msg cannot use any functions that use i18nCache at all!
 */
export function msg<T extends RegisterableMessages = string>(message: T): T;
export function msg<T extends RegisterableMessages = string>(
  message: T,
  options?: GTTranslationOptions
): T extends string ? string : string[];
export function msg(
  message: RegisterableMessages,
  options?: GTTranslationOptions
): RegisterableMessages {
  if (options?.$format === 'STRING') return msgString(message, options);

  // Handle array
  if (typeof message !== 'string') {
    if (!options) return message;
    return message.map((m, i) =>
      msg(m, {
        ...options,
        // ignore if $id is an empty string or not defined
        ...(options.$id && { $id: `${options.$id}.${i}` }),
      })
    );
  }

  if (!options) {
    return message;
  }

  const variables = extractVariables(options);
  let interpolatedString: string;
  if (options.$_twin === undefined) {
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
  } else {
    // Locale twins: the call site carries its content, already localized,
    // or `0` for its own source text
    const [locale, text] = Array.isArray(options.$_twin)
      ? (options.$_twin as [string, string])
      : [libraryDefaultLocale, message];
    interpolatedString = formatTwinContent(text, locale, variables);
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

/**
 * Formats a locale twin call site's content for the encoded text (what
 * decodeMsg() returns). The twin's locale is the configured locale, possibly
 * a custom alias, so the configured formatter resolves it once initializeGT()
 * ran.
 *
 * The marker goes into the encoded options, and m() formats the content
 * again with its own variables, so a failure here (variables m() supplies, as in
 * `m(msg('Welcome, {user}!'), { user })`, or an alias msg() cannot resolve
 * before initializeGT()) keeps the unformatted content instead of dropping
 * the message.
 */
function formatTwinContent(
  text: string,
  locale: string,
  variables: Record<string, unknown>
): string {
  const options = {
    locales: [locale],
    variables: { ...variables, [VAR_IDENTIFIER]: 'other' },
  };
  try {
    return isI18nConfigInitialized()
      ? getI18nConfig().formatMessage(text, undefined, options)
      : formatMessage(text, options);
  } catch {
    return text;
  }
}
