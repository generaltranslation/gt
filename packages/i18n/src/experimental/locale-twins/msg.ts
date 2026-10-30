import { formatMessage } from '@generaltranslation/format';
import {
  libraryDefaultLocale,
  VAR_IDENTIFIER,
} from 'generaltranslation/internal';
import logger from '../../logs/logger';
import { encodeMsg } from '../../translation-functions/msg/encodeMsg';
import { msg as regularMsg } from '../../translation-functions/msg/msg';
import type { RegisterableMessages } from '../../translation-functions/types/message';
import type {
  EncodedTranslationOptions,
  GTTranslationOptions,
} from '../../translation-functions/types/options';
import { createInterpolationFailureMessage } from '../../translation-functions/utils/messages';
import { extractVariables } from '../../utils/extractVariables';

/**
 * Marks an encoded `msg()` value whose `$_hash` the compiler injected. The
 * regular `msg()` encodes a hash it computed at runtime, which no twin
 * carries, so `m()` must render that one as source on both sides.
 */
const ATTRIBUTED_KEY = '$_twin';

/**
 * `msg()` with locale twins. Locale twin builds inject `$_hash` into every
 * attributed `msg()` call, also into those whose variables only `m()`
 * supplies (`m(msg('Hi {user}'), { user })`), and client builds strip the
 * message to `""`. Such a call is always encoded with its hash and marked as
 * attributed, so `m()` finds the twin entry, and a message that cannot be
 * formatted without its variables is not reported. Other calls behave like
 * the regular `msg()`.
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
  if (typeof message !== 'string' || !options?.$_hash) {
    return regularMsg(message, options);
  }
  if (options.$format === 'STRING') {
    return encodeMsg(message, {
      ...options,
      $_source: message,
      $_hash: options.$_hash,
      [ATTRIBUTED_KEY]: true,
    });
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
    [ATTRIBUTED_KEY]: true,
  });
}

/**
 * The options `m()` resolves a decoded `msg()` value with: its own variables
 * under the decoded options, keeping `$_hash` only when the compiler
 * attributed the message. Without it the lookup hashes at runtime and has
 * no compile-time hash, so it renders as source on the server and the
 * client alike.
 */
export function getLocaleTwinMessageOptions(
  decodedOptions: EncodedTranslationOptions,
  options: GTTranslationOptions
): GTTranslationOptions {
  const {
    [ATTRIBUTED_KEY]: attributed,
    $_hash,
    ...decoded
  } = decodedOptions as EncodedTranslationOptions & {
    [ATTRIBUTED_KEY]?: unknown;
  };
  return {
    ...extractVariables(options),
    ...decoded,
    ...(attributed === true && { $_hash }),
  };
}
