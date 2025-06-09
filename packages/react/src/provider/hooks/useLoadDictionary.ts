import { useEffect, useState } from "react";
import { CustomLoader } from "../../types/types";
import { Dictionary } from "../../types/types";
import loadDictionaryHelper from '../../dictionaries/loadDictionaryHelper';
import mergeDictionaries from '../../dictionaries/mergeDictionaries';

export function useLoadDictionary({
    _dictionary,
    loadDictionary,
    locale,
    defaultLocale
}: {
    _dictionary: Dictionary | undefined;
    loadDictionary: CustomLoader | undefined;
    locale: string;
    defaultLocale: string;
}) {
    const [dictionary, setDictionary] = useState<Dictionary | undefined>(
        _dictionary
      );
    
      // Resolve dictionary when not provided, but using custom dictionary loader
      useEffect(() => {
        // Early return if dictionary is provided or not loading translation dictionary
        if (!loadDictionary) return;
    
        let storeResults = true;
    
        (async () => {
          // Load dictionary for default locale
          const defaultLocaleDictionary =
            (await loadDictionaryHelper(defaultLocale, loadDictionary)) || {};
    
          // Load dictionary for locale
          const localeDictionary =
            (await loadDictionaryHelper(locale, loadDictionary)) || {};
    
          // Merge dictionaries
          const mergedDictionary = mergeDictionaries(
            defaultLocaleDictionary,
            localeDictionary
          );
    
          // Update dictionary
          if (storeResults) {
            setDictionary(mergedDictionary || {});
          }
        })();
    
        // cancel load if a dep changes
        return () => {
          storeResults = false;
        };
      }, [loadDictionary, locale, defaultLocale]);
    return dictionary;
}