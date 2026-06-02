import { useCallback, useMemo } from 'react';
import {
  extractVariables,
  renderDictionaryEntry,
  renderDictionaryObject,
  resolveDictionaryLookupOptions,
} from 'gt-i18n/internal';
import { useDictionaryObject } from './external-store';
import { useLocale } from './condition-store';
import { useGT } from './useGT';
import type {
  DictionaryObjectTranslation,
  DictionaryTranslationOptions,
} from 'gt-i18n/types';
import { useDefaultLocale } from './i18n-config';
import { useShouldTranslate } from './utils';
import { useLookupResolver } from '../i18n-store/lookup-adapter/useLookupResolver';

// ===== Hook ===== //

export function useTranslations(id?: string): UseTranslationsFunction {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  const lookupResolver = useLookupResolver();
  const gt = useGT();
  const rootId = id ?? '';

  useDictionaryObject({ locale: defaultLocale, id: rootId });
  useDictionaryObject({ locale, id: rootId });

  const translateEntry = useCallback(
    (suffix: string, options: DictionaryTranslationOptions = {}) => {
      const entryId = getEntryId(id, suffix);
      const sourceEntry = lookupResolver.resolveDictionaryEntry({
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

      const targetLookup = { locale, id: entryId };
      const targetEntry = lookupResolver.resolveDictionaryEntry(targetLookup);
      if (targetEntry === undefined) {
        lookupResolver.handleMissingDictionaryEntry(targetLookup);
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
    [defaultLocale, gt, id, locale, lookupResolver, shouldTranslate]
  );

  const translateObject = useCallback(
    (suffix: string) => {
      const entryId = getEntryId(id, suffix);
      const sourceObject = lookupResolver.resolveDictionaryObject({
        locale: defaultLocale,
        id: entryId,
      });
      if (sourceObject === undefined) {
        throw new Error(`Dictionary entry ${entryId} cannot be found`);
      }

      let targetObject = undefined;
      if (shouldTranslate) {
        const targetLookup = { locale, id: entryId };
        targetObject = lookupResolver.resolveDictionaryObject(targetLookup);
        if (targetObject === undefined) {
          lookupResolver.handleMissingDictionaryObject(targetLookup);
        }
      }

      return renderDictionaryObject({
        sourceObject,
        targetObject,
        translate: (sourceEntry, dictionaryOptions) =>
          lookupResolver.resolveTranslation({
            locale: shouldTranslate ? locale : defaultLocale,
            message: sourceEntry.entry,
            options: dictionaryOptions,
          }),
      });
    },
    [defaultLocale, id, locale, lookupResolver, shouldTranslate]
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
