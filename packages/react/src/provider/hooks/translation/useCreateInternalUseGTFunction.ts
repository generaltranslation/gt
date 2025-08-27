import { hashSource } from 'generaltranslation/id';
import {
  InlineTranslationOptions,
  Translations,
  _Messages,
  _Message,
} from '../../../types/types';
import { TranslateIcuCallback } from '../../../types/runtime';
import { GT } from 'generaltranslation';
import {
  createStringRenderError,
  createStringTranslationError,
} from '../../../errors/createErrors';
import { decodeMsg, decodeOptions } from '../../../internal';

export default function useCreateInternalUseGTFunction({
  gt,
  translations,
  locale,
  defaultLocale,
  translationRequired,
  developmentApiEnabled,
  registerIcuForTranslation,
}: {
  gt: GT;
  translations: Translations | null;
  locale: string;
  defaultLocale: string;
  translationRequired: boolean;
  developmentApiEnabled: boolean;
  registerIcuForTranslation: TranslateIcuCallback;
}): {
  _tFunction: (
    message: string,
    options?: InlineTranslationOptions,
    preloadedTranslations?: Translations
  ) => string;
  _mFunction: (
    message: string,
    options?: Record<string, any>,
    preloadedTranslations?: Translations
  ) => string;
  _filterMessagesForPreload: (_messages: _Messages) => _Messages;
  _preloadMessages: (_messages: _Messages) => Promise<Translations>;
} {
  // --------- HELPER FUNCTIONS ------- //

  function initializeT(
    message: string,
    options: Record<string, any> & {
      $context?: string;
      $id?: string;
      $_hash?: string;
    } = {}
  ) {
    if (!message || typeof message !== 'string') return null;

    const { $id: id, $context: context, $_hash: _hash, ...variables } = options;

    // Update renderContent to use actual variables
    const renderMessage = (msg: string, locales: string[]) => {
      return gt.formatMessage(msg, {
        locales,
        variables,
      });
    };

    // Calculate hash
    const calculateHash = () =>
      hashSource({
        source: message,
        ...(context && { context }),
        ...(id && { id }),
        dataFormat: 'ICU',
      });

    return {
      id,
      context,
      _hash,
      variables,
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
    let hash = ''; // empty string because 1) it has to be a string but 2) we don't always need to calculate it
    if (id) {
      translationEntry = translations?.[id];
    }
    if (_hash && typeof translationEntry === 'undefined') {
      hash = _hash;
      translationEntry = translations?.[_hash];
    }
    // Use calculated hash to index
    if (typeof translationEntry === 'undefined') {
      hash = calculateHash();
      translationEntry = translations?.[hash];
    }
    return {
      translationEntry,
      hash,
    };
  }

  const _filterMessagesForPreload = (_messages: _Messages): _Messages => {
    const result = [];
    for (const { message, ...options } of _messages) {
      const init = initializeT(message, options);
      if (!init) continue;
      const { id, _hash, calculateHash } = init;
      const { translationEntry, hash } = getTranslationData(
        calculateHash,
        id,
        _hash
      );
      if (!translationEntry) {
        result.push({ message, ...options, $_hash: hash });
      }
    }
    return result;
  };

  const _preloadMessages = async (_messages: _Messages) => {
    const preloadedTranslations: Translations = {};
    const preload = async ({ message, ...options }: _Message) => {
      // Setup
      const init = initializeT(message, options);
      if (!init) return;
      const { id, context, _hash, calculateHash } = init;
      const { translationEntry, hash } = getTranslationData(
        calculateHash,
        id,
        _hash
      );
      // Return if no translation needed
      if (translationEntry) {
        preloadedTranslations[hash] = translationEntry;
      }
      // Await the creation of the translation
      // Should update the translations object
      preloadedTranslations[hash] = await registerIcuForTranslation({
        source: message,
        targetLocale: locale,
        metadata: {
          ...(context && { context }),
          ...(id && { id }),
          hash,
        },
      });
    };
    await Promise.all(_messages.map(preload));
    return preloadedTranslations;
  };

  const _tFunction = (
    message: string,
    options: InlineTranslationOptions = {},
    preloadedTranslations: Translations | undefined
  ) => {
    // ----- SET UP ----- //
    const init = initializeT(message, options);
    if (!init) return '';
    const { id, context, _hash, calculateHash, renderMessage } = init;

    // ----- EARLY RETURN IF TRANSLATION NOT REQUIRED ----- //
    // Check: translation required
    if (!translationRequired) return renderMessage(message, [defaultLocale]);

    // ----- GET TRANSLATION ----- //

    const { translationEntry, hash } = getTranslationData(
      calculateHash,
      id,
      _hash
    );

    // ----- RENDER TRANSLATION ----- //

    if (translationEntry === null) {
      return renderMessage(message, [defaultLocale]);
    }

    // If a translation already exists
    if (translationEntry) {
      try {
        return renderMessage(translationEntry as string, [
          locale,
          defaultLocale,
        ]);
      } catch (error) {
        console.error(createStringRenderError(message, id), 'Error: ', error);
        return renderMessage(message, [defaultLocale]);
      }
    }

    if (typeof preloadedTranslations?.[hash] !== 'undefined') {
      if (preloadedTranslations?.[hash]) {
        try {
          return renderMessage(preloadedTranslations?.[hash] as string, [
            locale,
            defaultLocale,
          ]);
        } catch (error) {
          console.error(createStringRenderError(message, id), 'Error: ', error);
        }
      }
      return renderMessage(message, [defaultLocale]);
    }

    if (!developmentApiEnabled) {
      console.warn(createStringTranslationError(message, id, 't'));
      return renderMessage(message, [defaultLocale]);
    }

    registerIcuForTranslation({
      source: message,
      targetLocale: locale,
      metadata: {
        ...(context && { context }),
        ...(id && { id }),
        hash: hash || '',
      },
    });

    return renderMessage(message, [defaultLocale]);
  };

  const _mFunction = (
    encodedMsg: string,
    options: Record<string, any> = {},
    preloadedTranslations: Translations | undefined
  ) => {
    // Decode message and return if it's invalid

    const decodedOptions = decodeOptions(encodedMsg);
    if (!decodedOptions || !decodedOptions.$_hash || !decodedOptions.$_source) {
      return encodedMsg;
      // return _tFunction(encodedMsg, options, preloadedTranslations); (moved to compiler solution instead of this)
    }

    // Disaggregate options and construct render function

    const { $_hash, $_source, $context, $hash, $id, ...decodedVariables } =
      decodedOptions;

    const renderMessage = (msg: string, locales: string[]) => {
      return gt.formatMessage(msg, {
        locales,
        variables: { ...decodedVariables, ...options },
      });
    };

    // Return if default locale

    if (!translationRequired) return renderMessage($_source, [defaultLocale]);

    // Check translation entry

    const translationEntry = translations?.[decodedOptions.$_hash];

    // Check translations
    if (translationEntry === null) {
      return renderMessage($_source, [defaultLocale]);
    }

    // If a translation already exists
    if (translationEntry) {
      try {
        return renderMessage(translationEntry as string, [
          locale,
          defaultLocale,
        ]);
      } catch (error) {
        console.error(
          createStringRenderError($_source, decodeMsg(encodedMsg)),
          'Error: ',
          error
        );
        return renderMessage($_source, [defaultLocale]);
      }
    }

    if (!developmentApiEnabled) {
      console.warn(
        createStringTranslationError($_source, decodeMsg(encodedMsg), 'm')
      );
      return renderMessage($_source, [defaultLocale]);
    }

    if (typeof preloadedTranslations?.[$_hash] !== 'undefined') {
      if (preloadedTranslations?.[$_hash]) {
        try {
          return renderMessage(preloadedTranslations?.[$_hash] as string, [
            locale,
            defaultLocale,
          ]);
        } catch (error) {
          console.error(
            createStringRenderError($_source, decodeMsg(encodedMsg)),
            'Error: ',
            error
          );
        }
      }
      return renderMessage($_source, [defaultLocale]);
    }

    registerIcuForTranslation({
      source: $_source,
      targetLocale: locale,
      metadata: {
        ...($context && { context: $context }),
        hash: $_hash,
      },
    });

    return renderMessage($_source, [defaultLocale]);
  };

  return {
    _tFunction,
    _mFunction,
    _filterMessagesForPreload,
    _preloadMessages,
  };
}
