import { useTrackedDictionaryResolver } from '../external-store/useTrackedDictionaryResolver';
import { useTrackedDictionaryObjResolver } from '../external-store/useTrackedDictionaryObjResolver';
import { useCallback } from 'react';
import type { DictionaryLookup } from '../../i18n-store/storeTypes';
import { useDictionariesSnapshot } from '../../context/useSnapshots';
import {
  lookupDictionaryEntry,
  lookupDictionaryObject,
} from '../../i18n-store/utils/dictionaries';

function useDictionaryEntryResolverProd() {
  const dictionariesSnapshot = useDictionariesSnapshot();
  return useCallback(
    (lookup: DictionaryLookup) =>
      lookupDictionaryEntry(dictionariesSnapshot, lookup),
    [dictionariesSnapshot]
  );
}

function useDictionaryObjectResolverProd() {
  const dictionariesSnapshot = useDictionariesSnapshot();
  return useCallback(
    (lookup: DictionaryLookup) =>
      lookupDictionaryObject(dictionariesSnapshot, lookup),
    [dictionariesSnapshot]
  );
}

export const useDictionaryEntryResolver =
  process.env.NODE_ENV === 'production'
    ? useDictionaryEntryResolverProd
    : useTrackedDictionaryResolver;

export const useDictionaryObjectResolver =
  process.env.NODE_ENV === 'production'
    ? useDictionaryObjectResolverProd
    : useTrackedDictionaryObjResolver;
