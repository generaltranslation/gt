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

  const [translations, setTranslations] = useState<Translations | null>(
    initializeTranslations()
  );

  /**
   * Reset translations if locale changes (null to trigger a new cache fetch)
   * Should never run on mount
   *
   * TODO: its possible that this adds an unnecessary re-render, perhaps the request could be embeded directly in this useEffect instead?
   */
  const didMount = useRef(false);
  useEffect(() => {
    // Reset should never run on mount
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

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
