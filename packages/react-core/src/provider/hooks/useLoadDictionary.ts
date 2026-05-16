import { useEffect, useRef, useState } from 'react';
import { CustomLoader, Dictionary } from '../../types-dir/types';
import loadDictionaryHelper from '../../dictionaries/loadDictionaryHelper';

export function useLoadDictionary({
  _dictionary,
  _dictionaryTranslations = {},
  loadDictionary,
  locale,
  defaultLocale,
}: {
  _dictionary: Dictionary | undefined;
  _dictionaryTranslations: Dictionary | undefined;
  loadDictionary: CustomLoader | undefined;
  locale: string;
  defaultLocale: string;
}) {
  const [dictionary, setDictionary] = useState<Dictionary | undefined>(
    _dictionary
  );
  const [dictionaryTranslations, setDictionaryTranslations] = useState<
    Dictionary | undefined
  >(_dictionaryTranslations);

  // Update dictionary props when the provider receives new server data.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (loadDictionary) return;
    setDictionary(_dictionary);
    setDictionaryTranslations(_dictionaryTranslations);
  }, [_dictionary, _dictionaryTranslations, loadDictionary]);

  // Resolve dictionary when not provided, but using custom dictionary loader
  useEffect(() => {
    if (!loadDictionary) return;

    let storeResults = true;

    (async () => {
      // Load dictionary for default locale
      const defaultLocaleDictionary =
        (await loadDictionaryHelper(defaultLocale, loadDictionary)) || {};

      // Load dictionary for locale
      const localeDictionary =
        (await loadDictionaryHelper(locale, loadDictionary)) || {};

      // Update dictionary and dictionary translations
      if (storeResults) {
        setDictionary(defaultLocaleDictionary);
        setDictionaryTranslations(localeDictionary);
      }
    })();

    // cancel load if a dep changes
    return () => {
      storeResults = false;
    };
  }, [loadDictionary, locale, defaultLocale]);
  return {
    dictionary,
    setDictionary,
    dictionaryTranslations,
    setDictionaryTranslations,
  };
}
