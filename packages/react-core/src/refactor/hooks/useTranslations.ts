import { useCallback, useMemo } from 'react';
import {
  extractVariables,
  renderDictionaryEntry,
  renderDictionaryObject,
  resolveDictionaryLookupOptions,
} from 'gt-i18n/internal';
import {
  useDefaultLocale,
  useDictionaryObject,
  useRuntimeDictionaryScope,
} from './external-store-hooks';
import { useLocale } from './context-hooks';
import { useShouldTranslate } from './utils';
import { getI18nManager } from '../i18n-manager/singleton-operations';
import { useGT } from './useGT';
import type {
  DictionaryObjectTranslation,
  DictionaryTranslationOptions,
} from 'gt-i18n/types';

// ===== Hook ===== //

export function useTranslations(id?: string): UseTranslationsFunction {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  const scope = useRuntimeDictionaryScope();
  const gt = useGT();
  const rootId = id ?? '';

  useDictionaryObject({ locale: defaultLocale, id: rootId });
  useDictionaryObject({ locale, id: rootId });

  const translateEntry = useCallback(
    (suffix: string, options: DictionaryTranslationOptions = {}) => {
      const i18nManager = getI18nManager();
      const entryId = getEntryId(id, suffix);
      const sourceEntry = i18nManager.lookupDictionary(defaultLocale, entryId);
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

      const targetEntry = i18nManager.lookupDictionary(locale, entryId);
      // TODO: this should only be executed in dev mode
      if (targetEntry === undefined) {
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
    [defaultLocale, gt, id, locale, scope, shouldTranslate]
  );

  const translateObject = useCallback(
    (suffix: string) => {
      const i18nManager = getI18nManager();
      const entryId = getEntryId(id, suffix);
      const sourceObject = i18nManager.lookupDictionaryObj(
        defaultLocale,
        entryId
      );
      if (sourceObject === undefined) {
        throw new Error(`Dictionary entry ${entryId} cannot be found`);
      }

      let targetObject = undefined;
      if (shouldTranslate) {
        targetObject = i18nManager.lookupDictionaryObj(locale, entryId);
        // TODO: this should only be executed in dev mode
        if (targetObject === undefined) {
          scope.translateObject({ locale, id: entryId });
        }
      }

      return renderDictionaryObject({
        sourceObject,
        targetObject,
        translate: (sourceEntry, dictionaryOptions) =>
          i18nManager.lookupTranslation(
            shouldTranslate ? locale : defaultLocale,
            sourceEntry.entry,
            dictionaryOptions
          ),
      });
    },
    [defaultLocale, id, locale, scope, shouldTranslate]
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
