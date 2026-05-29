import { useCallback, useMemo } from 'react';
import {
  extractVariables,
  getI18nConfig,
  renderDictionaryEntry,
  renderDictionaryObject,
  resolveDictionaryLookupOptions,
} from 'gt-i18n/internal';
import {
  useDictionaryObject,
  useRuntimeDictionaryScope,
} from './external-store';
import { useLocale } from './condition-store';
import { getShouldTranslate } from './utils';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import { useI18nStoreWithFallback } from '../i18n-store/context';
import { useGT } from './useGT';
import type {
  DictionaryObjectTranslation,
  DictionaryTranslationOptions,
} from 'gt-i18n/types';

// ===== Hook ===== //

export function useTranslations(id?: string): UseTranslationsFunction {
  const locale = useLocale();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate = getShouldTranslate();
  const scope = useRuntimeDictionaryScope();
  const gt = useGT();
  const store = useI18nStoreWithFallback();
  const rootId = id ?? '';
  const devHotReloadEnabled = getReactI18nCache().isDevHotReloadEnabled();

  useDictionaryObject({ locale: defaultLocale, id: rootId });
  useDictionaryObject({ locale, id: rootId });

  const translateEntry = useCallback(
    (suffix: string, options: DictionaryTranslationOptions = {}) => {
      const entryId = getEntryId(id, suffix);
      const sourceEntry = store.getDictionaryEntrySnapshot({
        locale: defaultLocale,
        id: entryId,
      });
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

      const targetEntry = store.getDictionaryEntrySnapshot({
        locale,
        id: entryId,
      });
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
    [
      defaultLocale,
      devHotReloadEnabled,
      gt,
      id,
      locale,
      scope,
      shouldTranslate,
      store,
    ]
  );

  const translateObject = useCallback(
    (suffix: string) => {
      const entryId = getEntryId(id, suffix);
      const sourceObject = store.getDictionaryObjectSnapshot({
        locale: defaultLocale,
        id: entryId,
      });
      if (sourceObject === undefined) {
        throw new Error(`Dictionary entry ${entryId} cannot be found`);
      }

      let targetObject = undefined;
      if (shouldTranslate) {
        targetObject = store.getDictionaryObjectSnapshot({
          locale,
          id: entryId,
        });
        if (targetObject === undefined && devHotReloadEnabled) {
          scope.translateObject({ locale, id: entryId });
        }
      }

      return renderDictionaryObject({
        sourceObject,
        targetObject,
        translate: (sourceEntry, dictionaryOptions) =>
          store.getTranslateSnapshot({
            locale: shouldTranslate ? locale : defaultLocale,
            message: sourceEntry.entry,
            options: dictionaryOptions,
          }),
      });
    },
    [
      defaultLocale,
      devHotReloadEnabled,
      id,
      locale,
      scope,
      shouldTranslate,
      store,
    ]
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
