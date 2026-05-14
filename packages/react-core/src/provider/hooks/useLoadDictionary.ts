import { useEffect, useState } from 'react';
import { CustomLoader, Dictionary } from '../../types-dir/types';
import { loadDictionaryHelper } from '../../dictionaries/loadDictionaryHelper';

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

  useEffect(() => {
    if (!loadDictionary) return;

    let storeResults = true;

    (async () => {
      const [defaultLocaleDictionary, localeDictionary] = await Promise.all([
        loadDictionaryHelper(defaultLocale, loadDictionary),
        loadDictionaryHelper(locale, loadDictionary),
      ]);

      if (!storeResults) return;
      setDictionary(defaultLocaleDictionary || {});
      setDictionaryTranslations(localeDictionary || {});
    })();

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
