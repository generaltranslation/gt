import { formatMessage } from '@generaltranslation/format';
import {
  libraryDefaultLocale,
  VAR_IDENTIFIER,
} from 'generaltranslation/internal';
import logger from '../../logs/logger';
import { encodeMsg } from '../../translation-functions/msg/encodeMsg';
import { msg as regularMsg } from '../../translation-functions/msg/msg';
import type { RegisterableMessages } from '../../translation-functions/types/message';
import type { GTTranslationOptions } from '../../translation-functions/types/options';
import { createInterpolationFailureMessage } from '../../translation-functions/utils/messages';
import { extractVariables } from '../../utils/extractVariables';

/**
 * `msg()` with locale twins. Locale twin builds inject `$_hash` into every
 * attributed `msg()` call, also into those whose variables only `m()`
 * supplies (`m(msg('Hi {user}'), { user })`), and client builds strip the
 * message to `""`. Such a call is always encoded with its hash, so `m()`
 * finds the twin entry, and a message that cannot be formatted without its
 * variables is not reported. Other calls behave like the regular `msg()`.
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
  if (
    typeof message !== 'string' ||
    !options?.$_hash ||
    options.$format === 'STRING'
  ) {
    return regularMsg(message, options);
  }
  const variables = extractVariables(options);
  let interpolatedString: string;
  try {
    interpolatedString = formatMessage(message, {
      locales: [libraryDefaultLocale],
      variables: { ...variables, [VAR_IDENTIFIER]: 'other' },
    });
  } catch {
    if (Object.keys(variables).length > 0) {
      logger.warn(createInterpolationFailureMessage(message));
    }
    interpolatedString = message;
  }
  return encodeMsg(interpolatedString, {
    ...options,
    $_source: message,
    $_hash: options.$_hash,
  });
}
