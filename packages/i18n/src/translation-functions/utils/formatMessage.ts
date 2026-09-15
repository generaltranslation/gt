import type { StringFormat } from '@generaltranslation/format/types';
import logger from '../../logs/logger';
import { createInterpolationFailureMessage } from './messages';
import {
  getI18nConfig,
  isI18nConfigInitialized,
} from '../../i18n-config/singleton-operations';
import { formatMessage as formatUnconfiguredMessage } from '@generaltranslation/format';

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
  locales?: string | string[],
  dataFormat?: StringFormat
): string {
  try {
    // Fallback helpers also work before initializeGT(). Once configured, use
    // its custom mapping so app aliases never reach Intl as language codes.
    if (!isI18nConfigInitialized()) {
      return formatUnconfiguredMessage(encodedMsg, {
        variables,
        locales,
        dataFormat,
      });
    }
    return getI18nConfig().formatMessage(encodedMsg, undefined, {
      variables,
      locales,
      dataFormat,
    });
  } catch {
    logger.warn(createInterpolationFailureMessage(encodedMsg));
    return encodedMsg;
  }
}
