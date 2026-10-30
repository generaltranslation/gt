/**
 * Locale twin versions of gt-i18n's request-scoped translation functions:
 * `getGTInternal()` and `getMessagesInternal()` resolve compiled content from
 * the registered twins first and otherwise translate as usual.
 */
import type { StringFormat } from '@generaltranslation/format/types';
import { getI18nConfig } from '../../i18n-config/singleton-operations';
import { getGTInternal as getRegularGTInternal } from '../../translation-functions/internal/getGT';
import type { Message } from '../../translation-functions/internal/getGT';
import { createLookupOptions } from '../../translation-functions/internal/helpers';
import { decodeOptions } from '../../translation-functions/msg/decodeOptions';
import type {
  GTFunctionType,
  MFunctionType,
} from '../../translation-functions/types/functions';
import type { GTTranslationOptions } from '../../translation-functions/types/options';
import { interpolateMessage } from '../../translation-functions/utils/interpolation/interpolateMessage';
import { isEncodedTranslationOptions } from '../../translation-functions/utils/isEncodedTranslationOptions';
import { extractVariables } from '../../utils/extractVariables';
import { resolveLocaleTwinLookup } from './runtime';

type Conditions = { locale: string; enableI18n: boolean };

/**
 * `getGTInternal()` with locale twins: a compiled entry renders from its
 * registered twin (a source fallback formats in the source locale), and
 * content no twin carries renders its source text on the client and the
 * server alike.
 */
export async function getGTInternal(
  conditions: Conditions,
  _messages?: Message[]
): Promise<GTFunctionType> {
  const gt = await getRegularGTInternal(conditions, _messages);
  const sourceLocale = getI18nConfig().getDefaultLocale();
  return (message: string, options: GTTranslationOptions = {}) => {
    const lookupOptions = createLookupOptions<StringFormat>(
      conditions.enableI18n
        ? (options.$locale ?? conditions.locale)
        : sourceLocale,
      options,
      'ICU'
    );
    const twin = resolveLocaleTwinLookup<string>(
      lookupOptions.$locale,
      lookupOptions,
      options.$_hash
    );
    if (twin.entry === undefined && !twin.rendersSource) {
      return gt(message, options);
    }
    return interpolateMessage({
      source: message,
      target: twin.entry,
      options: twin.sourceFallback
        ? { ...lookupOptions, $locale: sourceLocale }
        : lookupOptions,
      sourceLocale,
    });
  };
}

/**
 * `getMessagesInternal()` with locale twins: resolves through the locale
 * twin {@link getGTInternal}. Variables given to `m()` fill in those
 * `msg()` did not have: `m(msg('Welcome, {user}!'), { user })` with the
 * compiler-injected `$_hash`.
 */
export async function getMessagesInternal(
  conditions: Conditions
): Promise<MFunctionType> {
  const gt = await getGTInternal(conditions);
  const m: MFunctionType = <T extends string | null | undefined>(
    encodedMsg: T,
    options: GTTranslationOptions = {}
  ): T extends string ? string : T => {
    type Result = T extends string ? string : T;
    if (encodedMsg == null) return encodedMsg as Result;
    const decodedOptions = decodeOptions(encodedMsg) ?? {};
    if (isEncodedTranslationOptions(decodedOptions)) {
      return gt(decodedOptions.$_source, {
        ...extractVariables(options),
        ...decodedOptions,
      }) as Result;
    }
    return gt(encodedMsg, options) as Result;
  };
  return m;
}
