import {
  getDictionaryListenerKey,
  getI18nConfig,
  getTranslateListenerKey,
} from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import { useEffect } from 'react';
import { useGTContext, type GTContextType } from '../../context/context';
import type { ReactI18nLookup } from '../../i18n-cache/ReactI18nCache';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import type { DictionaryLookup, TranslateLookup } from '../../i18n-cache/types';
import { useShouldTranslate } from '../utils';

export type OnMissingTranslation = <T extends Translation>(
  lookup: TranslateLookup<T>
) => void;
export type OnMissingDictionaryEntry = (lookup: DictionaryLookup) => void;
export type OnMissingDictionaryObj = (lookup: DictionaryLookup) => void;

type DictionaryMissingHandlers = {
  dictionaryEntry: OnMissingDictionaryEntry;
  dictionaryObject: OnMissingDictionaryObj;
};

const noopTranslation: OnMissingTranslation = () => {};
const noopDictionary: OnMissingDictionaryEntry = () => {};
const noopDictionaryHandlers: DictionaryMissingHandlers = {
  dictionaryEntry: noopDictionary,
  dictionaryObject: noopDictionary,
};

function useHandleMissing(shouldTranslate: boolean) {
  const context = useGTContext();
  const cache = getReactI18nCache();
  const pending = new Map<string, ReactI18nLookup>();
  const devHotReloadEnabled =
    process.env.NODE_ENV !== 'production' &&
    getI18nConfig().isDevHotReloadEnabled();

  useEffect(() => {
    if (!devHotReloadEnabled || !shouldTranslate) return;
    pending.forEach((lookup) => void cache.resolveMissing(lookup));
  }, [cache, devHotReloadEnabled, pending, shouldTranslate]);

  return (lookup: ReactI18nLookup) => {
    if (handleMissingOverride(context, lookup)) return;
    if (context?.resolveMissingDuringRender) {
      void cache.resolveMissing(lookup);
    } else {
      pending.set(getLookupKey(lookup), lookup);
    }
  };
}

function handleMissingOverride(
  context: GTContextType | undefined,
  lookup: ReactI18nLookup
): boolean {
  switch (lookup.type) {
    case 'translation': {
      if (!context?.onMissingTranslation) return false;
      const { type: _type, ...translationLookup } = lookup;
      context.onMissingTranslation(translationLookup);
      return true;
    }
    case 'dictionaryEntry': {
      if (!context?.onMissingDictionaryEntry) return false;
      const { type: _type, ...dictionaryLookup } = lookup;
      context.onMissingDictionaryEntry(dictionaryLookup);
      return true;
    }
    case 'dictionaryObject': {
      if (!context?.onMissingDictionaryObj) return false;
      const { type: _type, ...dictionaryLookup } = lookup;
      context.onMissingDictionaryObj(dictionaryLookup);
      return true;
    }
  }
}

function getLookupKey(lookup: ReactI18nLookup): string {
  const key =
    lookup.type === 'translation'
      ? getTranslateListenerKey(lookup)
      : getDictionaryListenerKey(lookup);
  return `${lookup.type}:${key}`;
}

function useHandleMissingTranslationDev(): OnMissingTranslation {
  const handle = useHandleMissing(useShouldTranslate());
  return (lookup) => handle({ type: 'translation', ...lookup });
}

function useHandleMissingTranslationWithConditionsDev(
  shouldTranslate: boolean
): OnMissingTranslation {
  const handle = useHandleMissing(shouldTranslate);
  return (lookup) => handle({ type: 'translation', ...lookup });
}

function useHandleMissingDictionaryDev(): DictionaryMissingHandlers {
  const handle = useHandleMissing(useShouldTranslate());
  return {
    dictionaryEntry: (lookup) => handle({ type: 'dictionaryEntry', ...lookup }),
    dictionaryObject: (lookup) =>
      handle({ type: 'dictionaryObject', ...lookup }),
  };
}

export const useHandleMissingTranslation: () => OnMissingTranslation =
  process.env.NODE_ENV === 'production'
    ? () => noopTranslation
    : useHandleMissingTranslationDev;

export const useHandleMissingTranslationWithConditions: (
  shouldTranslate: boolean
) => OnMissingTranslation =
  process.env.NODE_ENV === 'production'
    ? () => noopTranslation
    : useHandleMissingTranslationWithConditionsDev;

export const useHandleMissingDictionary: () => DictionaryMissingHandlers =
  process.env.NODE_ENV === 'production'
    ? () => noopDictionaryHandlers
    : useHandleMissingDictionaryDev;
