import {
  extractVariables,
  getI18nCache,
  getI18nConfig,
  renderDictionaryEntry,
  renderDictionaryObject,
  resolveDictionaryLookupOptions,
} from 'gt-i18n/internal';
import type {
  DictionaryObjectTranslation,
  TranslationVariables,
} from 'gt-i18n/types';
import { getConditionStore } from './condition-store';
import { getShouldTranslate } from './internal/getFormatLocales';
import {
  queueRuntimeDictionaryTranslation,
  trackTranslations,
} from './internal/reactivity';
import { useGT } from './translate';

export type UseTranslationsFunction = ((
  id: string,
  options?: TranslationVariables
) => string) & {
  obj: (id: string) => DictionaryObjectTranslation;
};

/**
 * Returns a `t()` function that resolves entries from the translation
 * dictionary by id.
 *
 * ```ts
 * const t = useTranslations();
 * t('greetings.hello');
 * ```
 */
export function useTranslations(rootId?: string): UseTranslationsFunction {
  const gt = useGT();

  const resolveConditions = () => {
    const conditionStore = getConditionStore();
    const locale = conditionStore.getLocale();
    return {
      locale,
      defaultLocale: getI18nConfig().getDefaultLocale(),
      shouldTranslate: getShouldTranslate({
        locale,
        enableI18n: conditionStore.getEnableI18n(),
      }),
    };
  };

  const translateEntry = (
    suffix: string,
    options: TranslationVariables = {}
  ): string => {
    trackTranslations();

    const id = getId(rootId, suffix);
    const { locale, defaultLocale, shouldTranslate } = resolveConditions();

    const sourceEntry = getI18nCache().lookupDictionary(defaultLocale, id);
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

    const targetEntry = getI18nCache().lookupDictionary(locale, id);
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

    // Dev hot reload: translate the entry on the fly
    if (getI18nConfig().isDevHotReloadEnabled()) {
      queueRuntimeDictionaryTranslation({ locale, id });
    }
    return gt(sourceEntry.entry, {
      ...sourceOptions,
      ...extractVariables(options),
      $locale: locale,
    });
  };

  const translateObject = (suffix: string): DictionaryObjectTranslation => {
    trackTranslations();

    const entryId = getId(rootId, suffix);
    const { locale, defaultLocale, shouldTranslate } = resolveConditions();

    const sourceObject = getI18nCache().lookupDictionaryObj(
      defaultLocale,
      entryId
    );
    if (sourceObject === undefined) {
      throw new Error(`Dictionary entry ${entryId} cannot be found`);
    }

    let targetObject = undefined;
    if (shouldTranslate) {
      targetObject = getI18nCache().lookupDictionaryObj(locale, entryId);
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
  };

  return Object.assign(translateEntry, { obj: translateObject });
}

function getId(prefix: string | undefined, suffix: string): string {
  return prefix ? `${prefix}.${suffix}` : suffix;
}
