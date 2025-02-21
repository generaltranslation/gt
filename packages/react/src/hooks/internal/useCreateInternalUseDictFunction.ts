import { useCallback } from 'react';
import {
    Dictionary,
    DictionaryTranslationOptions,
    InlineTranslationOptions,
} from '../../types/types';
import getDictionaryEntry, { isValidDictionaryEntry } from '../../provider/helpers/getDictionaryEntry';
import getEntryAndMetadata from '../../provider/helpers/getEntryAndMetadata';
import { createLibraryNoEntryWarning } from '../../messages/createMessages';

export default function useCreateInternalUseDictFunction({
  dictionary,
  _internalUseGTFunction
}: {
  dictionary: Dictionary;
  _internalUseGTFunction: (string: string, options?: InlineTranslationOptions) => string
}) {
  return useCallback(
    (id: string, options: DictionaryTranslationOptions = {}): string => {
        const value = getDictionaryEntry(dictionary, id);
        const valueIsValid = isValidDictionaryEntry(value);
        if (!valueIsValid) {
            console.error(createLibraryNoEntryWarning(id))
            return '';
        }
        const { entry, metadata } = getEntryAndMetadata(value);
        return _internalUseGTFunction(entry, {
            ...metadata,
            ...options,
            id
        });
    },
    [
        dictionary,
        _internalUseGTFunction
    ]
  );
}
