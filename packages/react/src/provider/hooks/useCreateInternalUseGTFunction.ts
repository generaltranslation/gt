import { hashSource } from 'generaltranslation/id';
import { useCallback } from 'react';
import {
  InlineTranslationOptions,
  Translations,
  RenderMethod,
  _Messages,
  _Message,
} from '../../types/types';
import { TranslateIcuCallback } from '../../types/runtime';
import { formatMessage, GT } from 'generaltranslation';

export default function useCreateInternalUseGTFunction({
  gt,
  translations,
  locale,
  defaultLocale,
  translationRequired,
  runtimeTranslationEnabled,
  registerIcuForTranslation,
}: {
  gt: GT;
  translations: Translations | null;
  locale: string;
  defaultLocale: string;
  translationRequired: boolean;
  runtimeTranslationEnabled: boolean;
  registerIcuForTranslation: TranslateIcuCallback;
}): {
  _tFunction: (message: string, options?: InlineTranslationOptions) => string;
  _preloadMessages: (_messages: _Messages) => Promise<void>;
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
      if (_hash && _hash !== hash) {
        console.error(
          `Hash mismatch: Buildtime: "${_hash}". Runtime: "${hash}"`
        );
      }
      translationEntry = translations?.[hash];
    }
    return {
      translationEntry,
      hash,
    };
  }

  const _preloadMessages = async (_messages: _Messages) => {
    const preload = async ({ message, ...options }: _Message) => {
      // Early return if possible
      if (!message) return;
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
      if (translationEntry) return;
      // Await the creation of the translation
      // Should update the translations object
      await registerIcuForTranslation({
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
  };

  const _tFunction = (
    message: string,
    options: InlineTranslationOptions = {}
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
      return renderMessage(translationEntry as string, [locale, defaultLocale]);
    }

    if (!runtimeTranslationEnabled) {
      // Warn here
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

  return { _tFunction, _preloadMessages };
}
