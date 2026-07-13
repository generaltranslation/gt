import { useCallback, useMemo } from 'react';
import {
  extractVariables,
  renderDictionaryEntry,
  renderDictionaryObject,
  resolveDictionaryLookupOptions,
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
      const id = getId(rootId, suffix);

      const sourceEntry = resolveDictionaryEntry({
        locale: defaultLocale,
        id,
      });
      if (sourceEntry === undefined) {
        throw new Error(`Dictionary entry ${id} cannot be found`);
      }
      const sourceOptions = resolveDictionaryLookupOptions(sourceEntry.options);
      if (!shouldTranslate) {
        return gt(sourceEntry.entry, {
          ...sourceOptions,
          ...extractVariables(options),
          $locale: defaultLocale,
        });
      }

      const targetEntry = resolveDictionaryEntry({ locale, id });
      if (targetEntry?.entry != null) {
        return renderDictionaryEntry({
          sourceLocale: defaultLocale,
          targetLocale: locale,
          sourceEntry,
          target: targetEntry.entry,
          dictionaryOptions: sourceOptions,
          options,
        });
      }

      return gt(sourceEntry.entry, {
        ...sourceOptions,
        ...extractVariables(options),
        $locale: locale,
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
      const entryId = getId(rootId, suffix);
      const sourceObject = resolveDictionaryObject({
        locale: defaultLocale,
        id: entryId,
      });
      if (sourceObject === undefined) {
        throw new Error(`Dictionary entry ${entryId} cannot be found`);
      }

      let targetObject = undefined;
      if (shouldTranslate) {
        const targetLookup = { locale, id: entryId };
        targetObject = resolveDictionaryObject(targetLookup);
      }

      return renderDictionaryObject({
        sourceObject,
        targetObject,
        translate: (sourceEntry, dictionaryOptions) =>
          gt(sourceEntry.entry, {
            ...dictionaryOptions,
            $locale: shouldTranslate ? locale : defaultLocale,
          }),
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
