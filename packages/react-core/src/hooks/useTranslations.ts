import { useCallback, useMemo } from 'react';
import {
  resolveDictionaryEntryTranslation,
  resolveDictionaryObjectTranslation,
} from 'gt-i18n/internal';
import { useLocale } from './condition-store';
import { useGT } from './useGT';
import type {
  DictionaryObjectTranslation,
  TranslationVariables,
} from 'gt-i18n/types';
import { useDefaultLocale } from './i18n-config';
import { useShouldTranslate } from './utils';
import { useTrackedDictionaryResolver } from './external-store/useTrackedDictionaryResolver';
import { useTrackedDictionaryObjResolver } from './external-store/useTrackedDictionaryObjResolver';

// ===== Hook ===== //

export function useTranslations(rootId?: string): UseTranslationsFunction {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  const gt = useGT();
  const resolveDictionaryEntry = useTrackedDictionaryResolver();
  const translateObject = useTranslationsObj(rootId);

  const translateEntry = useCallback(
    (suffix: string, options: TranslationVariables = {}) => {
      // Miss handling lives inside the tracked resolver, which enqueues dev
      // hot reload translations for missing entries itself.
      return resolveDictionaryEntryTranslation({
        id: getId(rootId, suffix),
        options,
        locale,
        defaultLocale,
        shouldTranslate,
        resolveEntry: (locale, id) => resolveDictionaryEntry({ locale, id }),
        gt,
      });
    },
    [defaultLocale, gt, rootId, locale, resolveDictionaryEntry, shouldTranslate]
  );

  return useMemo(
    () => Object.assign(translateEntry, { obj: translateObject }),
    [translateEntry, translateObject]
  );
}

function useTranslationsObj(rootId?: string): UseTranslationsObjFunction {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  const gt = useGT();
  const resolveDictionaryObject = useTrackedDictionaryObjResolver();

  return useCallback(
    (suffix: string) => {
      return resolveDictionaryObjectTranslation({
        id: getId(rootId, suffix),
        locale,
        defaultLocale,
        shouldTranslate,
        resolveObject: (locale, id) => resolveDictionaryObject({ locale, id }),
        gt,
      });
    },
    [
      defaultLocale,
      rootId,
      locale,
      resolveDictionaryObject,
      shouldTranslate,
      gt,
    ]
  );
}

// ===== Lookup Helpers ===== //

function getId(prefix: string | undefined, suffix: string): string {
  return prefix ? `${prefix}.${suffix}` : suffix;
}

// ===== Types ===== //

export type UseTranslationsFunction = ((
  id: string,
  options?: TranslationVariables
) => string) & {
  obj: (id: string) => DictionaryObjectTranslation;
};

type UseTranslationsObjFunction = (id: string) => DictionaryObjectTranslation;
