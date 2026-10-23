import { useCallback } from 'react';
import {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  TranslateLookup,
} from '../i18n-store/storeTypes';
import { Translation } from 'gt-i18n/types';
import {
  useDictionariesSnapshot,
  useTranslationsSnapshot,
} from '../i18n-store/useI18nStore';
import {
  lookupDictionaryEntry,
  lookupDictionaryObject,
} from '../i18n-store/utils/dictionaries';
import { hashMessage } from 'gt-i18n/internal';

export function useLookup<Content extends Translation>(
  lookup: TranslateLookup<Content>
): Content | undefined {
  const cb = useGetLookupCb();
  return cb(lookup);
}

export function useGetLookupCb(): <Content extends Translation>(
  lookup: TranslateLookup<Content>
) => Content | undefined {
  const translationsSnapshot = useTranslationsSnapshot();
  return useCallback(
    <Content extends Translation>(lookup: TranslateLookup<Content>) => {
      const hash =
        lookup.options.$_hash ?? hashMessage(lookup.message, lookup.options);
      return translationsSnapshot[lookup.locale]?.[hash] as Content;
    },
    [translationsSnapshot]
  );
}

export function useGetDictionaryEntryLookupCb(): (
  lookup: DictionaryLookup
) => DictionaryEntrySnapshot {
  const dictionariesSnapshot = useDictionariesSnapshot();
  return useCallback(
    (lookup: DictionaryLookup) =>
      lookupDictionaryEntry(dictionariesSnapshot, lookup),
    [dictionariesSnapshot]
  );
}

export function useGetDictionaryObjectLookupCb(): (
  lookup: DictionaryLookup
) => DictionaryObjectSnapshot {
  const dictionariesSnapshot = useDictionariesSnapshot();
  return useCallback(
    (lookup: DictionaryLookup) =>
      lookupDictionaryObject(dictionariesSnapshot, lookup),
    [dictionariesSnapshot]
  );
}
