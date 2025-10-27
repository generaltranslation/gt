// getTranslationFunction.ts (refactored)

import getI18NConfig from '../../config-dir/getI18NConfig';
import { getLocale } from '../../server';
import { hashSource } from 'generaltranslation/id';
import {
  createStringRenderError,
  createStringTranslationError,
  createTranslationLoadingWarning,
} from '../../errors/createErrors';
import {
  InlineTranslationOptions,
  _Message,
  _Messages,
  decodeMsg,
  decodeOptions,
  reactHasUse,
} from 'gt-react/internal';
import use from '../../utils/use';

type RenderFn = (msg: string, locales: string[]) => string;

type InitResult = {
  id?: string;
  context?: string;
  _hash?: string;
  variables: Record<string, any>;
  calculateHash: () => string;
  renderMessage: RenderFn;
};

type Translator = {
  t: (
    message: string,
    options?: InlineTranslationOptions & {
      $id?: string;
      $context?: string;
      $_hash?: string;
    }
  ) => string;
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
  const gt = I18NConfig.getGTClass();

  const translations = translationRequired
    ? await I18NConfig.getCachedTranslations(locale)
    : undefined;

  // --------- HELPERS --------- //
  function initializeT(
    message: string,
    options: Record<string, any> & {
      $context?: string;
      $id?: string;
      $_hash?: string;
    } = {}
  ): InitResult | null {
    if (!message || typeof message !== 'string') return null;

    const { $id: id, $context: context, $_hash: _hash, ...variables } = options;

    const renderMessage: RenderFn = (msg, locales) =>
      gt.formatMessage(msg, {
        locales,
        variables,
      });

    const calculateHash = () =>
      hashSource({
        source: message,
        ...(context && { context }),
        ...(id && { id }),
        dataFormat: 'ICU',
      });

    return { id, context, _hash, variables, calculateHash, renderMessage };
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
    id?: string;
    hash: string;
    renderMessage: RenderFn;
  }) {
    const { source, context, id, hash, renderMessage } = args;
    try {
      I18NConfig.translateIcu({
        source,
        targetLocale: locale,
        options: {
          ...(context && { context }),
          ...(id && { id }),
          hash,
        },
      }).then((result) => {
        // eslint-disable-next-line no-console
        console.warn(
          createTranslationLoadingWarning({
            ...(id && { id }),
            source: renderMessage(source, [defaultLocale]),
            translation: renderMessage(result as string, [
              locale,
              defaultLocale,
            ]),
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
      const init = initializeT(message, options);
      if (!init) return;

      const { id, context, _hash, calculateHash } = init;
      const { translationEntry, hash } = getTranslationData(
        calculateHash,
        id,
        _hash
      );
      if (translationEntry) return; // exists already

      try {
        preloadedTranslations![hash] = (await I18NConfig.translateIcu({
          source: message,
          targetLocale: locale,
          options: {
            ...(context && { context }),
            ...(id && { id }),
            hash,
          },
        })) as string;
      } catch (error) {
        console.warn(error);
      }
    };
    await Promise.all(_messages.map(preload));
  }

  // ---------- t() ---------- /

  const t = (
    message: string,
    options: Record<string, any> & {
      $context?: string;
      $id?: string;
      $_hash?: string;
    } = {}
  ): string => {
    const init = initializeT(message, options);
    if (!init) return '';
    const { id, context, _hash, calculateHash, renderMessage } = init;

    // Early: no translation needed
    if (!translationRequired) return renderMessage(message, [defaultLocale]);

    const { translationEntry, hash } = getTranslationData(
      calculateHash,
      id,
      _hash
    );

    if (translationEntry) {
      try {
        return renderMessage(translationEntry as string, [
          locale,
          defaultLocale,
        ]);
      } catch (error) {
        console.error(error);
        return renderMessage(message, [defaultLocale]);
      }
    }

    if (!I18NConfig.isDevelopmentApiEnabled()) {
      console.warn(createStringTranslationError(message, id, 't'));
      return renderMessage(message, [defaultLocale]);
    }

    if (!translationEntry && preloadedTranslations?.[hash]) {
      try {
        return renderMessage(preloadedTranslations[hash], [
          locale,
          defaultLocale,
        ]);
      } catch (error) {
        console.error(createStringRenderError(message, id), 'Error: ', error);
        return renderMessage(message, [defaultLocale]);
      }
    }

    // On-demand translate
    scheduleTranslateOnDemand({
      source: message,
      context,
      id,
      hash,
      renderMessage,
    });
    return renderMessage(message, [defaultLocale]);
  };

  // ---------- m() ---------- //
  const m = <T extends string | null | undefined>(
    encodedMsg: T,
    options?: Record<string, any>
  ): T extends string ? string : T => {
    
    if (!encodedMsg) return encodedMsg as T extends string ? string : T;
    
    // Try to decode first
    const decodedOptions = decodeOptions(encodedMsg);

    // Fallback to t() if not an encoded message
    if (!decodedOptions || !decodedOptions.$_hash || !decodedOptions.$_source) {
      return t(encodedMsg, options) as T extends string ? string : T;
    }

    const { $_hash, $_source, $context, $id, ...decodedVariables } =
      decodedOptions;

    const renderMessage: RenderFn = (msg, locales) =>
      gt.formatMessage(msg, {
        locales,
        variables: { ...decodedVariables, ...options },
      });

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
      try {
        return renderMessage(translationEntry as string, [
          locale,
          defaultLocale,
        ]) as T extends string ? string : T;
      } catch (error) {
        console.error(
          createStringRenderError($_source, decodeMsg(encodedMsg)),
          'Error: ',
          error
        );
        return renderMessage($_source, [defaultLocale]) as T extends string
          ? string
          : T;
      }
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
        try {
          return renderMessage(preloadedTranslations[$_hash] as string, [
            locale,
            defaultLocale,
          ]) as T extends string ? string : T;
        } catch (error) {
          console.error(
            createStringRenderError($_source, decodeMsg(encodedMsg)),
            'Error: ',
            error
          );
        }
      }
      return renderMessage($_source, [defaultLocale]) as T extends string
        ? string
        : T;
    }

    // On-demand translate
    scheduleTranslateOnDemand({
      source: $_source,
      context: $context,
      id: $id,
      hash: $_hash,
      renderMessage,
    });

    // Default: return source while translation loads
    return renderMessage($_source, [defaultLocale]) as T extends string
      ? string
      : T;
  };

  return { t, m };
}

// ---------------- Public API (kept stable) ---------------- //

/**
 * getGT() returns a function that translates an ICU message string.
 *
 * @returns A promise of the t() function used for translating strings
 *
 * @example
 * const t = await getGT();
 * console.log(t('Hello, world!')); // Translates 'Hello, world!'
 */
export async function getGT(
  _messages?: _Messages
): Promise<(message: string, options?: InlineTranslationOptions) => string> {
  const { t } = await createTranslator(_messages);
  return t;
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
    options?: Record<string, any>
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
  options?: Record<string, any>
) => T extends string ? string : T {
  return use(getMessages(_messages));
}
