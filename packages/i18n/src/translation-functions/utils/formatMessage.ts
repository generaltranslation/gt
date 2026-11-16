import type { StringFormat } from '@generaltranslation/format';
import {
  getI18nConfig,
  isI18nConfigInitialized,
} from '../../i18n-config/singleton-operations';
import { formatMessage as formatUnconfiguredMessage } from 'generaltranslation/internal';

/**
 * Given an encoded message and variables, formats the message.
 * Throws when the message cannot be formatted, so callers can fall back to the source.
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
  // Fallback helpers also work before initializeGT(). Once configured, use
  // its custom mapping so app aliases never reach Intl as language codes.
  if (!isI18nConfigInitialized()) {
    return formatUnconfiguredMessage(encodedMsg, {
      variables,
      locales,
      dataFormat,
    });
  }
  return getI18nConfig().formatMessage(encodedMsg, {
    variables,
    locales,
    dataFormat,
  });
}
