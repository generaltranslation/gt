import { useCallback, useMemo } from 'react';
import type { TranslationVariables } from 'gt-i18n/internal';
import {
  renderDictionaryEntry,
  renderDictionaryObject,
  resolveDictionaryLookupOptions,
  type DictionaryEntry,
  type DictionaryObjectTranslation,
  type TFunctionType,
} from 'gt-i18n/internal/compat';
import { useLocale } from '../hooks/condition-store';
import { useDefaultLocale } from '../hooks/i18n-config';
import { useShouldTranslate } from '../hooks/utils';
import { useTranslationResolver } from '../hooks/lookup';
import { useTrackedDictionaryResolver } from './useTrackedDictionaryResolver';
import { useTrackedDictionaryObjResolver } from './useTrackedDictionaryObjResolver';

// ===== Hook ===== //

export function useTranslations(rootId?: string): TFunctionType {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  const renderEntry = useRenderDictionaryEntry();
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
      const target = shouldTranslate
        ? resolveDictionaryEntry({ locale, id })?.entry
        : undefined;
      return renderEntry(
        sourceEntry,
        resolveDictionaryLookupOptions(sourceEntry.options),
        target,
        options
      );
    },
    [
      defaultLocale,
      renderEntry,
      rootId,
      locale,
      resolveDictionaryEntry,
      shouldTranslate,
    ]
  );

  // Wrap instead of mutating translateEntry, so the returned function changes
  // identity when either translateEntry or translateObject changes
  return useMemo(
    () =>
      Object.assign(
        (suffix: string, options?: TranslationVariables) =>
          translateEntry(suffix, options),
        { obj: translateObject }
      ),
    [translateEntry, translateObject]
  );
}

function useTranslationsObj(rootId?: string): UseTranslationsObjFunction {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  const renderEntry = useRenderDictionaryEntry();
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
          renderEntry(sourceEntry, dictionaryOptions),
      });
    },
    [
      defaultLocale,
      rootId,
      locale,
      resolveDictionaryObject,
      shouldTranslate,
      renderEntry,
    ]
  );
}

/**
 * Renders a source entry in the render locale: with `target` when the target
 * dictionary has the entry, else with the entry's translation from the
 * translations snapshot or cache, else from the source.
 */
function useRenderDictionaryEntry() {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  const resolveTranslation = useTranslationResolver(shouldTranslate);

  return useCallback(
    (
      sourceEntry: DictionaryEntry,
      dictionaryOptions: ReturnType<typeof resolveDictionaryLookupOptions>,
      target?: string,
      options?: TranslationVariables
    ): string =>
      renderDictionaryEntry({
        sourceLocale: defaultLocale,
        targetLocale: shouldTranslate ? locale : defaultLocale,
        sourceEntry,
        target: shouldTranslate
          ? (target ??
            resolveTranslation({
              locale,
              content: sourceEntry.entry,
              options: { ...dictionaryOptions, $locale: locale },
            }))
          : undefined,
        dictionaryOptions,
        options,
      }),
    [defaultLocale, locale, shouldTranslate, resolveTranslation]
  );
}

// ===== Lookup Helpers ===== //

function getId(prefix: string | undefined, suffix: string): string {
  return prefix ? `${prefix}.${suffix}` : suffix;
}

// ===== Types ===== //

type UseTranslationsObjFunction = (id: string) => DictionaryObjectTranslation;
