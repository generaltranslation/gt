import { useCallback, useMemo, useState } from 'react';
import {
  Dictionary,
  DictionaryTranslationOptions,
  InlineTranslationOptions,
} from '../../types/types';
import getDictionaryEntry, {
  isValidDictionaryEntry,
} from '../../provider/helpers/getDictionaryEntry';
import getEntryAndMetadata from '../../provider/helpers/getEntryAndMetadata';
import {
  createInvalidDictionaryEntryWarning,
  createNoEntryFoundWarning,
} from '../../messages/createMessages';

export default function useCreateInternalUseDictFunction({
  dictionary,
  _internalUseGTFunction,
}: {
  dictionary: Dictionary;
  _internalUseGTFunction: (
    string: string,
    options?: InlineTranslationOptions
  ) => string;
}) {
  return useCallback(
    (id: string, options: DictionaryTranslationOptions = {}): string => {
      // Get entry
      const value = getDictionaryEntry(dictionary, id);

      // Check: no entry found
      if (!value) {
        console.warn(createNoEntryFoundWarning(id));
        return '';
      }

      // Check: invalid entry
      if (!isValidDictionaryEntry(value)) {
        console.warn(createInvalidDictionaryEntryWarning(id));
        return '';
      }

      // Get entry and metadata
      const { entry, metadata } = getEntryAndMetadata(value);

      // Return translation
      return _internalUseGTFunction(entry, {
        ...metadata,
        ...options,
        id,
      });
    },
    [dictionary, _internalUseGTFunction]
  );
}
