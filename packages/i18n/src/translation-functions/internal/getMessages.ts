import { InlineResolveOptions } from '../types/options';
import { decodeOptions } from '../msg/decodeOptions';
import { isEncodedTranslationOptions } from '../utils/isEncodedTranslationOptions';
import { getGTInternal } from './getGT';
import type { I18nRequestConditions } from './getGT';
import { MFunctionType } from '../types/functions';
import { getLocale } from '../../helpers/locale';
import { getEnableI18n } from '../../helpers/conditions';

/**
 * Returns the m function that resolves a registered message to its translation.
 * @returns A promise of the m function
 * @important Must be used inside of a request context
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
  return getMessagesInternal({
    locale: getLocale(),
    enableI18n: getEnableI18n(),
  });
}

/**
 * Condition-store-free version of {@link getMessages}: request conditions are
 * passed as parameters instead of being read from the condition store.
 * @param {I18nRequestConditions} conditions - The request conditions
 * @returns A promise of the m function
 */
export async function getMessagesInternal(
  conditions: I18nRequestConditions
): Promise<MFunctionType> {
  // Get the gt function
  const gt = await getGTInternal(conditions);

  /**
   * Resolves a registered message to its translation.
   * @param {string | null | undefined} encodedMsg - The encoded message to decode and interpolate.
   * @param {InlineTranslationOptions} options - The options to interpolate.
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
    options: InlineResolveOptions = {}
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
