import logger from '../logs/logger';
import { createInterpolationFailureMessage } from './messages';
import {
  getI18nConfig,
  isI18nConfigInitialized,
} from '../i18n-config/singleton-operations';
import { formatIcu } from 'generaltranslation/internal';

/**
 * Given an encoded message and variables, formats the message.
 * On error, the original encoded message is returned with a warning.
 * @param encodedMsg
 * @param variables
 * @returns
 */
export function formatMessage(
  encodedMsg: string,
  variables: Record<string, string>,
  locales?: string | string[]
): string {
  try {
    // Formatting also works before initializeGT(). Once configured, use
    // its custom mapping so app aliases never reach Intl as language codes.
    const options = { values: variables, locales };
    return isI18nConfigInitialized()
      ? getI18nConfig().formatIcu(encodedMsg, options)
      : formatIcu(encodedMsg, options);
  } catch {
    logger.warn(createInterpolationFailureMessage(encodedMsg));
    return encodedMsg;
  }
}
