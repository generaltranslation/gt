import { GTTranslationOptions } from '../types/options';
import { decodeOptions } from '../msg/decodeOptions';
import { isEncodedTranslationOptions } from '../utils/isEncodedTranslationOptions';
import { getGTInternal } from './getGT';
import { MFunctionType } from '../types/functions';
import { getWritableConditionStore } from '../../condition-store/singleton-operations';

/**
 * Returns the m function that resolves a registered message to its translation.
 * @returns A promise of the m function
 *
 * @example
 * // Registration
 * const registeredMessage = msg('Hello, world!');
 *
 * // Resolution
 * const m = await getMessages();
 * const greeting = m(registeredMessage);
 */
export async function getMessages(): Promise<MFunctionType> {
  const conditionStore = getWritableConditionStore();
  const locale = conditionStore.getLocale();
  const enableI18n = conditionStore.getEnableI18n();
  return getMessagesInternal({ locale, enableI18n });
}

/**
 * Condition store agnostic getMessages function
 */
export async function getMessagesInternal({
  locale,
  enableI18n,
}: {
  locale: string;
  enableI18n: boolean;
}): Promise<MFunctionType> {
  // Get the gt function
  const gt = await getGTInternal({ locale, enableI18n });

  /**
   * Resolves a registered message to its translation.
   * @param {string | null | undefined} encodedMsg - The encoded message to decode and interpolate.
   * @param {GTTranslationOptions} options - The options to interpolate.
   * @returns - The decoded and interpolated message.
   *
   * @example
   * // Simple message without interpolation
   * const m = await getMessages();
   * const greeting = m(msg('Hello, world!'));
   *
   * @example
   * // Message with interpolation
   * const m = await getMessages();
   * const welcome = m(msg('Welcome, {user}!'), { user: 'Alice' });
   */
  const m: MFunctionType = <T extends string | null | undefined>(
    encodedMsg: T,
    options: GTTranslationOptions = {}
  ): T extends string ? string : T => {
    // Return if the encoded message is null or undefined
    if (encodedMsg == null) return encodedMsg as T extends string ? string : T;

    // Get any encoded options
    const decodedOptions = decodeOptions(encodedMsg) ?? {};

    // Return early if string already interpolated eg: mFallback(msg('Hello, {name}!', { name: 'Brian' }))
    if (isEncodedTranslationOptions(decodedOptions)) {
      return gt(decodedOptions.$_source, decodedOptions) as T extends string
        ? string
        : T;
    }

    // Use gt to interpolate
    // Separate from decoded options to match behavior in @gt/react-core
    return gt(encodedMsg, options) as T extends string ? string : T;
  };

  return m;
}
