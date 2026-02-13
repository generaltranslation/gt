import { customLoadTranslationsError } from '../../errors-dir/createErrors';
import fetchTranslations from '../../utils/fetchTranslations';
import { CustomLoader, Translations } from '../../types-dir/types';
import { useEffect, useRef, useState } from 'react';
import { GT } from 'generaltranslation';
import { defaultCacheUrl } from 'generaltranslation/internal';

export function useLoadTranslations({
  _translations,
  translationRequired,
  loadTranslationsType,
  loadTranslations,
  locale,
  cacheUrl,
  projectId,
  _versionId,
  gt,
}: {
  _translations: Translations | null;
  translationRequired: boolean;
  loadTranslationsType: string;
  loadTranslations?: CustomLoader;
  locale: string;
  cacheUrl: string | null;
  projectId: string;
  _versionId?: string;
  gt: GT;
}) {
  /** Key for translation tracking:
   * Cache Loading            -> translations = null
   * Cache Fail (for locale)  -> translations = {}
   * Cache Fail (for hash)    -> translations[hash] = undefined
   */

  /**
   * Initialize translations
   */
  function initializeTranslations() {
    if (_translations) {
      return _translations;
    } else if (translationRequired && loadTranslationsType !== 'disabled') {
      return null;
    } else {
      // No need to load translations ever
      return {};
    }
  }

  const [translations, _setTranslations] = useState<Translations | null>(
    initializeTranslations()
  );

  // TODO: debugging, remove later
  const setTranslations: typeof _setTranslations = (
    newTranslationsOrUpdater:
      | Translations
      | null
      | ((prev: Translations | null) => Translations | null)
  ): void => {
    if (typeof newTranslationsOrUpdater === 'function') {
      _setTranslations((prev) => {
        const result = newTranslationsOrUpdater(prev);
        const type =
          result === null
            ? 'fetch (null)'
            : Object.keys(result).length > 0
              ? 'set'
              : 'reset {}';
        console.log('[useLoadTranslations] setTranslations type:', type);
        return result;
      });
    } else {
      const type =
        newTranslationsOrUpdater === null
          ? 'fetch (null)'
          : Object.keys(newTranslationsOrUpdater).length > 0
            ? 'set'
            : 'reset {}';
      console.log('[useLoadTranslations] setTranslations type:', type);
      _setTranslations(newTranslationsOrUpdater);
    }
  };

  /**
   * Reset translations if locale changes (null to trigger a new cache fetch)
   * Should never run on mount
   */
  const didMount = useRef(false);
  useEffect(() => {
    // Reset should never run on mount
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    console.log('[useLoadTranslations] translationReset');
    setTranslations(
      translationRequired && loadTranslationsType !== 'disabled' ? null : {}
    );
  }, [locale, loadTranslationsType]);

  /**
   * Update translations
   */
  useEffect(() => {
    // Early return if no need to translate
    if (
      translations ||
      !translationRequired ||
      loadTranslationsType === 'disabled'
    ) {
      return;
    }

    // Fetch translations
    let storeResults = true;
    (async () => {
      let result;
      switch (loadTranslationsType) {
        case 'custom':
          // check is redundant, but makes ts happy
          if (loadTranslations) {
            try {
              result = await loadTranslations(locale);
            } catch (error) {
              console.error(customLoadTranslationsError(locale), error);
            }
          }
          break;
        case 'default':
          try {
            result = await fetchTranslations({
              cacheUrl: cacheUrl || defaultCacheUrl,
              projectId,
              locale,
              versionId: _versionId,
              gt,
            });
          } catch (error) {
            console.error(error);
          }
          break;
      }

      // fallback to empty object if failed or disabled
      if (!result) {
        result = {};
      }

      // Record results
      if (storeResults) {
        console.log('[useLoadTranslations] translationFetcher');

        setTranslations(result); // not classified as a translation error, because we can still fetch from API
      }
    })();

    // Cancel fetch if a dep changes
    return () => {
      storeResults = false;
    };
  }, [
    translations,
    translationRequired,
    loadTranslationsType,
    cacheUrl,
    projectId,
    locale,
    _versionId,
    gt,
  ]);

  return {
    translations,
    setTranslations,
  };
}
