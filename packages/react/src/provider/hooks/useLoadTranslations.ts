import { customLoadTranslationsError } from '../../errors/createErrors';
import fetchTranslations from '../../utils/fetchTranslations';
import {
  CustomLoader,
  TranslationsStatus,
  Translations,
} from '../../types/types';
import { useEffect, useState } from 'react';

export function useLoadTranslations({
  _translations,
  translationRequired,
  loadTranslationsType,
  loadTranslations,
  locale,
  cacheUrl,
  projectId,
  _versionId,
}: {
  _translations: Translations | null;
  translationRequired: boolean;
  loadTranslationsType: string;
  loadTranslations?: CustomLoader;
  locale: string;
  cacheUrl: string;
  projectId: string;
  _versionId?: string;
}) {
  /** Key for translation tracking:
   * Cache Loading            -> translations = null
   * Cache Fail (for locale)  -> translations = {}
   * Cache Fail (for hash)    -> translations[hash] = undefined
   */

  const [translations, setTranslations] = useState<Translations | null>(
    _translations ||
      (translationRequired && loadTranslationsType !== 'disabled')
      ? null
      : {}
  );

  // Mapping of hashes to translation result status
  const [translationsStatus, setTranslationsStatus] =
    useState<TranslationsStatus | null>(null);

  // Reset translations if locale changes (null to trigger a new cache fetch)
  useEffect(() => {
    setTranslations(
      translationRequired && loadTranslationsType !== 'disabled' ? null : {}
    );
    setTranslationsStatus(
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
        setTranslationsStatus(
          Object.keys(result).reduce((acc: TranslationsStatus, hash) => {
            acc[hash] = {
              status: 'success',
            };
            return acc;
          }, {})
        );
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
  ]);

  return {
    translations,
    setTranslations,
    translationsStatus,
    setTranslationsStatus,
  };
}
