import { getMessagesInternal } from 'gt-i18n/internal';
import type { MFunctionType } from 'gt-i18n/types';
import type { _Messages } from 'gt-react/internal';
import { getI18NConfig } from '../../config-dir/getI18NConfig';
import { getRequestConditions } from '../../request/getRequestConditions';
import { use } from '../../utils/use';

/**
 * getMessages() returns a function that translates an encoded ICU message string.
 *
 * @returns A promise of the m() function used for translating encoded ICU message strings
 *
 * @example
 * const encodedMsg = msg('Hello, world!')
 * const m = await getMessages();
 * console.log(m(encodedMsg)); // Translates 'Hello, world!'
 */
export async function getMessages(
  _messages?: _Messages
): Promise<MFunctionType> {
  getI18NConfig();
  const { _locale: locale, _enableI18n: enableI18n } =
    await getRequestConditions();
  return getMessagesInternal({ locale, enableI18n });
}

/**
 * Hook wrapper for getMessages
 */
export function useMessages(_messages?: _Messages): MFunctionType {
  return use(getMessages(_messages));
}
