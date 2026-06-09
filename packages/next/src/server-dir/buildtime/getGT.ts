import { getGTInternal } from 'gt-i18n/internal';
import type { GTFunctionType } from 'gt-i18n/types';
import type { _Messages } from 'gt-react/internal';
import { getI18NConfig } from '../../config-dir/getI18NConfig';
import { getRequestConditions } from '../../request/getRequestConditions';
import { use } from '../../utils/use';

/**
 * getGT() returns a function that translates an ICU message string.
 *
 * @returns A promise of the t() function used for translating strings.
 * The returned function accepts `InlineTranslationOptions` which includes:
 * - `$format` - The data format for the message (e.g., 'ICU', 'STRING'). Defaults to 'ICU'.
 * - `$context` - Additional context for the translation.
 * - `$id` - Optional identifier for the translation string.
 * - `$maxChars` - Maximum number of characters for the translated message.
 *
 * @example
 * const t = await getGT();
 * console.log(t('Hello, world!')); // Translates 'Hello, world!'
 */
export async function getGT(_messages?: _Messages): Promise<GTFunctionType> {
  getI18NConfig();
  const { _locale: locale, _enableI18n: enableI18n } =
    await getRequestConditions();
  return getGTInternal({ locale, enableI18n });
}

/**
 * Hook wrapper for getGT
 */
export function useGT(_messages?: _Messages): GTFunctionType {
  return use(getGT(_messages));
}
