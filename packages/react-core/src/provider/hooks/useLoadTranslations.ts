import { customLoadTranslationsError } from '../../errors-dir/createErrors';
import fetchTranslations from '../../utils/fetchTranslations';
import { CustomLoader, Translations } from '../../types-dir/types';
import { useEffect, useState } from 'react';
import { GT } from 'generaltranslation';

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
  cacheUrl: string;
  projectId: string;
  _versionId?: string;
  gt: GT;
}) {
  /** Key for translation tracking:
   * Cache Loading            -> translations = null
   * Cache Fail (for locale)  -> translations = {}
   * Cache Fail (for hash)    -> translations[hash] = undefined
   */

  const [translations, setTranslations] = useState<Translations | null>(
    (() => {
      return _translations ||
        (translationRequired && loadTranslationsType !== 'disabled')
        ? null
        : {};
    })()
  );

  // Reset translations if locale changes (null to trigger a new cache fetch)
  useEffect(() => {
    setTranslations(
      translationRequired && loadTranslationsType !== 'disabled' ? null : {}
    );
  }, [locale, loadTranslationsType]);

  useEffect(() => {
    // Early return if no need to translate
    if (
      translations ||
      !translationRequired ||
      loadTranslationsType === 'disabled'
    )
      return;

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
              cacheUrl,
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
