import { useCallback, useMemo } from 'react';
import {
  extractVariables,
  renderDictionaryEntry,
  renderDictionaryObject,
  resolveDictionaryLookupOptions,
} from 'gt-i18n/internal';
import {
  useDictionaryObject,
  useRuntimeDictionaryScope,
} from './external-store';
import { useLocale } from './condition-store';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import { useGT } from './useGT';
import type {
  DictionaryObjectTranslation,
  DictionaryTranslationOptions,
} from 'gt-i18n/types';
import { useDefaultLocale } from './i18n-config';
import { useShouldTranslate } from './utils';

// ===== Hook ===== //

export function useTranslations(id?: string): UseTranslationsFunction {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  const scope = useRuntimeDictionaryScope();
  const gt = useGT();
  const rootId = id ?? '';
  const devHotReloadEnabled = getReactI18nCache().isDevHotReloadEnabled();

  useDictionaryObject({ locale: defaultLocale, id: rootId });
  useDictionaryObject({ locale, id: rootId });

  const translateEntry = useCallback(
    (suffix: string, options: DictionaryTranslationOptions = {}) => {
      const i18nCache = getReactI18nCache();
      const entryId = getEntryId(id, suffix);
      const sourceEntry = i18nCache.lookupDictionary(defaultLocale, entryId);
      if (sourceEntry === undefined) {
        throw new Error(`Dictionary entry ${entryId} cannot be found`);
      }
      if (!shouldTranslate) {
        return gt(sourceEntry.entry, {
          ...resolveDictionaryLookupOptions(sourceEntry.options),
          ...extractVariables(options),
          $locale: defaultLocale,
        });
      }

      const targetEntry = i18nCache.lookupDictionary(locale, entryId);
      if (targetEntry === undefined && devHotReloadEnabled) {
        scope.translateEntry({ locale, id: entryId });
      }

      if (targetEntry?.entry != null) {
        return renderDictionaryEntry({
          sourceLocale: defaultLocale,
          targetLocale: locale,
          sourceEntry,
          target: targetEntry.entry,
          dictionaryOptions: resolveDictionaryLookupOptions(
            sourceEntry.options
          ),
          options,
        });
      }

      return gt(sourceEntry.entry, {
        ...resolveDictionaryLookupOptions(sourceEntry.options),
        ...extractVariables(options),
        $locale: locale,
      });
    },
    [defaultLocale, devHotReloadEnabled, gt, id, locale, scope, shouldTranslate]
  );

  const translateObject = useCallback(
    (suffix: string) => {
      const i18nCache = getReactI18nCache();
      const entryId = getEntryId(id, suffix);
      const sourceObject = i18nCache.lookupDictionaryObj(
        defaultLocale,
        entryId
      );
      if (sourceObject === undefined) {
        throw new Error(`Dictionary entry ${entryId} cannot be found`);
      }

      let targetObject = undefined;
      if (shouldTranslate) {
        targetObject = i18nCache.lookupDictionaryObj(locale, entryId);
        if (targetObject === undefined && devHotReloadEnabled) {
          scope.translateObject({ locale, id: entryId });
        }
      }

      return renderDictionaryObject({
        sourceObject,
        targetObject,
        translate: (sourceEntry, dictionaryOptions) =>
          i18nCache.lookupTranslation(
            shouldTranslate ? locale : defaultLocale,
            sourceEntry.entry,
            dictionaryOptions
          ),
      });
    },
    [defaultLocale, devHotReloadEnabled, id, locale, scope, shouldTranslate]
  );

  return useMemo(
    () => Object.assign(translateEntry, { obj: translateObject }),
    [translateEntry, translateObject]
  );
}

// ===== Lookup Helpers ===== //

function getEntryId(prefix: string | undefined, suffix: string): string {
  return prefix ? `${prefix}.${suffix}` : suffix;
}

// ===== Types ===== //

export type UseTranslationsFunction = ((
  id: string,
  options?: DictionaryTranslationOptions
) => string) & {
  obj: (id: string) => DictionaryObjectTranslation;
};
