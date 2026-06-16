// getTranslationFunction.ts (refactored)

import { getI18NConfig } from '../../config-dir/getI18NConfig';
import { getLocale } from '../../server';
import { hashSource } from 'generaltranslation/id';
import {
  createStringRenderError,
  createStringRenderWarning,
  createStringTranslationError,
  createTranslationLoadingWarning,
} from '../../errors/createErrors';
import { decodeMsg, decodeOptions, reactHasUse } from 'gt-react/internal';
import type {
  InlineTranslationOptions,
  _Message,
  _Messages,
} from 'gt-react/internal';
import {
  extractVars,
  condenseVars,
  VAR_IDENTIFIER,
  indexVars,
} from 'generaltranslation/internal';
import type {
  FormatVariables,
  StringFormat,
} from '@generaltranslation/format/types';
import { use } from '../../utils/use';

type RenderFn = (msg: string, locales: string[], fallback?: string) => string;

type GTStringOptions = InlineTranslationOptions & {
  $context?: string;
  $maxChars?: number;
  $id?: string;
  $_hash?: string;
};

function isStringFormat(value: unknown): value is StringFormat {
  return value === 'ICU' || value === 'I18NEXT' || value === 'STRING';
}

type RenderMessageParams = {
  message: string;
  variables: FormatVariables | undefined;
  locales: string[];
  fallback?: string;
  id?: string;
  maxChars?: number;
  format?: StringFormat;
};

type InitResult = {
  id?: string;
  context?: string;
  maxChars?: number;
  _hash?: string;
  variables: FormatVariables;
  dataFormat: StringFormat;
  calculateHash: () => string;
  renderMessage: RenderFn;
};

type Translator = {
  gt: (message: string, options?: GTStringOptions) => string;
  m: <T extends string | null | undefined>(
    encodedMsg: T,
    options?: InlineTranslationOptions
  ) => T extends string ? string : T;
};

async function createTranslator(_messages?: _Messages): Promise<Translator> {
  // ---------- SET UP ---------- //
  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired] = I18NConfig.requiresTranslation(locale);
  const gtClass = I18NConfig.getGTClass();

  const translations = translationRequired
    ? await I18NConfig.getCachedTranslations(locale)
    : undefined;

  // --------- HELPERS --------- //
  /**
   * @description Format message and fallback:
   * (1) format message
   * (2) format fallback
   * (3)
   *   - PRODUCTION: return fallback (unformatted)
   *   - DEVELOPMENT: throw error
   */
  function renderMessageHelper({
    message,
    variables,
    locales,
    fallback,
    id,
    maxChars,
    format,
  }: RenderMessageParams) {
    try {
      // (1) Try to format message
      const declaredVars = extractVars(fallback || '');
      const formattedMessage = gtClass.formatMessage(
        Object.keys(declaredVars).length ? condenseVars(message) : message,
        {
          locales,
          variables: {
            ...variables,
            ...declaredVars,
            [VAR_IDENTIFIER]: 'other',
          },
          dataFormat: format,
        }
      );
      const cutoffMessage = gtClass.formatCutoff(formattedMessage, {
        locales,
        maxChars,
      });
      return cutoffMessage;
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        console.warn(createStringRenderWarning(message, id, error));
      } else {
        // (3) If no fallback, throw error (non-prod)
        if (!fallback) {
          throw new Error(createStringRenderError(message, id, error));
        }

        console.error(createStringRenderError(message, id, error));
      }

      // (2) If format fails, format fallback
      if (fallback) {
        return renderMessageHelper({
          message: fallback,
          locales,
          variables,
          id,
          maxChars,
          format,
        });
      }

      // (3) Fallback to original message (unformatted)
      const cutoffMessage = gtClass.formatCutoff(message, {
        locales,
        maxChars,
      });
      return cutoffMessage; // fallback to original message (unformatted)
    }
  }
  function initializeGT(
    message: string,
    options: GTStringOptions = {}
  ): InitResult | null {
    if (!message || typeof message !== 'string') return null;

    const {
      $id: id,
      $context: context,
      $maxChars: maxChars,
      $_hash: _hash,
      $format: format,
      ...variables
    } = options;
    const formatVariables = variables as FormatVariables;
    const resolvedFormat = format ?? I18NConfig.getDefaultStringFormat();

    const renderMessage: RenderFn = (msg, locales, fallback) => {
      return renderMessageHelper({
        message: msg,
        locales,
        variables: formatVariables,
        id,
        fallback,
        maxChars,
        format: resolvedFormat,
      });
    };

    const calculateHash = () =>
      hashSource({
        source: resolvedFormat === 'ICU' ? indexVars(message) : message,
        ...(context && { context }),
        ...(maxChars != null && { maxChars: Math.abs(maxChars) }),
        ...(id && { id }),
        dataFormat: resolvedFormat,
      });

    return {
      id,
      context,
      maxChars,
      _hash,
      variables: formatVariables,
      dataFormat: resolvedFormat,
      calculateHash,
      renderMessage,
    };
  }

  function getTranslationData(
    calculateHash: () => string,
    id?: string,
    _hash?: string
  ) {
    let translationEntry;
    let hash = ''; // lazily computed if needed
    if (id) translationEntry = translations?.[id];
    if (!translationEntry && _hash && translations?.[_hash] !== undefined) {
      hash = _hash;
      translationEntry = translations?.[_hash];
    }
    if (!translationEntry) {
      hash = calculateHash();
      translationEntry = translations?.[hash];
    }
    return { translationEntry, hash };
  }

  function scheduleTranslateOnDemand(args: {
    source: string;
    context?: string;
    maxChars?: number;
    id?: string;
    hash: string;
    dataFormat: StringFormat;
    renderMessage: RenderFn;
  }) {
    const { source, context, maxChars, id, hash, dataFormat, renderMessage } =
      args;
    try {
      I18NConfig.translate({
        source: dataFormat === 'ICU' ? indexVars(source) : source,
        targetLocale: locale,
        options: {
          ...(context && { $context: context }),
          ...(maxChars != null && { $maxChars: maxChars }),
          ...(id && { $id: id }),
          $_hash: hash,
          $format: dataFormat,
        },
      }).then((result) => {
        // eslint-disable-next-line no-console
        console.warn(
          createTranslationLoadingWarning({
            ...(id && { id }),
            source: renderMessage(source, [defaultLocale]),
            translation: renderMessage(
              result as string,
              [locale, defaultLocale],
              source
            ),
          })
        );
      });
    } catch (error) {
      console.warn(error);
    }
  }

  // ---------- PRELOAD TRANSLATIONS IF _MESSAGES SUPPLIED --------- //
  let preloadedTranslations: Record<string, string> | undefined;
  if (
    reactHasUse &&
    _messages &&
    I18NConfig.isDevelopmentApiEnabled() &&
    translationRequired
  ) {
    preloadedTranslations = {};
    const preload = async ({
      message,
      ...options
    }: _Message): Promise<void> => {
      if (!message) return;
      const init = initializeGT(message, options);
      if (!init) return;

      const { id, context, maxChars, _hash, dataFormat, calculateHash } = init;
      const { translationEntry, hash } = getTranslationData(
        calculateHash,
        id,
        _hash
      );
      if (translationEntry) return; // exists already

      try {
        preloadedTranslations![hash] = (await I18NConfig.translate({
          source: dataFormat === 'ICU' ? indexVars(message) : message,
          targetLocale: locale,
          options: {
            ...(context && { $context: context }),
            ...(maxChars != null && { $maxChars: maxChars }),
            ...(id && { $id: id }),
            $_hash: hash,
            $format: dataFormat,
          },
        })) as string;
      } catch (error) {
        console.warn(error);
      }
    };
    await Promise.all(_messages.map(preload));
  }

  // ---------- gt() ---------- /

  const gt = (message: string, options: GTStringOptions = {}): string => {
    const init = initializeGT(message, options);
    if (!init) return '';
    const {
      id,
      context,
      maxChars,
      _hash,
      dataFormat,
      calculateHash,
      renderMessage,
    } = init;

    // Early: no translation needed
    if (!translationRequired) return renderMessage(message, [defaultLocale]);

    const { translationEntry, hash } = getTranslationData(
      calculateHash,
      id,
      _hash
    );

    if (translationEntry) {
      return renderMessage(
        translationEntry as string,
        [locale, defaultLocale],
        message
      );
    }

    if (!I18NConfig.isDevelopmentApiEnabled()) {
      console.warn(createStringTranslationError(message, id, 't'));
      return renderMessage(message, [defaultLocale]);
    }

    if (!translationEntry && preloadedTranslations?.[hash]) {
      return renderMessage(
        preloadedTranslations[hash],
        [locale, defaultLocale],
        message
      );
    }

    // On-demand translate
    scheduleTranslateOnDemand({
      source: message,
      context,
      maxChars,
      id,
      hash,
      dataFormat,
      renderMessage,
    });
    return renderMessage(message, [defaultLocale]);
  };

  // ---------- m() ---------- //
  const m = <T extends string | null | undefined>(
    encodedMsg: T,
    options?: InlineTranslationOptions
  ): T extends string ? string : T => {
    if (!encodedMsg) return encodedMsg as T extends string ? string : T;

    // Try to decode first
    const decodedOptions = decodeOptions(encodedMsg);

    // Fallback to t() if not an encoded message
    if (
      !decodedOptions ||
      typeof decodedOptions.$_hash !== 'string' ||
      typeof decodedOptions.$_source !== 'string'
    ) {
      return gt(encodedMsg, options) as T extends string ? string : T;
    }

    const {
      $_hash,
      $_source,
      $context,
      $id,
      $maxChars,
      $format,
      ...decodedVariables
    } = decodedOptions;
    const context = typeof $context === 'string' ? $context : undefined;
    const id = typeof $id === 'string' ? $id : undefined;
    const maxChars = typeof $maxChars === 'number' ? $maxChars : undefined;
    const format = isStringFormat($format) ? $format : undefined;
    const resolvedFormat = format ?? I18NConfig.getDefaultStringFormat();
    const formatVariables = decodedVariables as FormatVariables;

    const renderMessage: RenderFn = (msg, locales, fallback) => {
      return renderMessageHelper({
        message: msg,
        locales,
        variables: formatVariables,
        fallback,
        maxChars,
        format: resolvedFormat,
      });
    };

    // Early: default locale only
    if (!translationRequired)
      return renderMessage($_source, [defaultLocale]) as T extends string
        ? string
        : T;

    // Translation exists?
    const translationEntry = translations?.[$_hash];

    if (translationEntry === null) {
      return renderMessage($_source, [defaultLocale]) as T extends string
        ? string
        : T;
    }

    if (translationEntry) {
      return renderMessage(
        translationEntry as string,
        [locale, defaultLocale],
        $_source
      ) as T extends string ? string : T;
    }

    // Dev-only paths for loading or preloaded
    if (!I18NConfig.isDevelopmentApiEnabled()) {
      console.warn(
        createStringTranslationError($_source, decodeMsg(encodedMsg), 'm')
      );
      return renderMessage($_source, [defaultLocale]) as T extends string
        ? string
        : T;
    }

    if (typeof preloadedTranslations?.[$_hash] !== 'undefined') {
      if (preloadedTranslations?.[$_hash]) {
        return renderMessage(
          preloadedTranslations[$_hash] as string,
          [locale, defaultLocale],
          $_source
        ) as T extends string ? string : T;
      }
      return renderMessage($_source, [defaultLocale]) as T extends string
        ? string
        : T;
    }

    // On-demand translate
    scheduleTranslateOnDemand({
      source: $_source,
      context,
      maxChars,
      id,
      hash: $_hash,
      dataFormat: resolvedFormat,
      renderMessage,
    });

    // Default: return source while translation loads
    return renderMessage($_source, [defaultLocale]) as T extends string
      ? string
      : T;
  };

  return { gt: gt, m };
}

// ---------------- Public API (kept stable) ---------------- //

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
export async function getGT(
  _messages?: _Messages
): Promise<(message: string, options?: InlineTranslationOptions) => string> {
  const { gt } = await createTranslator(_messages);
  return gt;
}

/**
 * Hook wrapper for getGT
 */
export function useGT(_messages?: _Messages) {
  return use(getGT(_messages));
}

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
): Promise<
  <T extends string | null | undefined>(
    encodedMsg: T,
    options?: InlineTranslationOptions
  ) => T extends string ? string : T
> {
  const { m } = await createTranslator(_messages);
  return m;
}

/**
 * Hook wrapper for getMessages
 */
export function useMessages(
  _messages?: _Messages
): <T extends string | null | undefined>(
  encodedMsg: T,
  options?: InlineTranslationOptions
) => T extends string ? string : T {
  return use(getMessages(_messages));
}
