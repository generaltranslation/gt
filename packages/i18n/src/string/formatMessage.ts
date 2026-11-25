import {
  getI18nConfig,
  isI18nConfigInitialized,
} from '../i18n-config/singleton-operations';
import { formatIcu } from 'generaltranslation/internal';

/**
 * Given an encoded message and variables, formats the message.
 * Throws if the message cannot be formatted.
 * @param encodedMsg
 * @param variables
 * @returns
 */
export function formatMessage(
  encodedMsg: string,
  variables: Record<string, string>,
  locales?: string | string[]
): string {
  // Formatting also works before initializeGT(). Once configured, use
  // its custom mapping so app aliases never reach Intl as language codes.
  const options = { values: variables, locales };
  return isI18nConfigInitialized()
    ? getI18nConfig().formatIcu(encodedMsg, options)
    : formatIcu(encodedMsg, options);
}
