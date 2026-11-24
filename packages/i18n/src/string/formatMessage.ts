import type { StringFormat } from '@generaltranslation/format';
import logger from '../logs/logger';
import { createInterpolationFailureMessage } from './messages';
import { getIntl } from '../i18n-config/singleton-operations';

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
    return getIntl().formatMessage(encodedMsg, {
      variables,
      locales,
      dataFormat,
    });
  } catch {
    logger.warn(createInterpolationFailureMessage(encodedMsg));
    return encodedMsg;
  }
}
