import {
  getI18nCache,
  getI18nConfig,
  getShouldTranslate,
  resolveDictionaryEntryTranslation,
  resolveDictionaryObjectTranslation,
} from 'gt-i18n/internal';
import type {
  DictionaryObjectTranslation,
  TranslationVariables,
} from 'gt-i18n/types';
import { getConditionStore } from './condition-store';
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

  // Dev hot reload: translate missing target entries on the fly
  const handleMissingTargetEntry = (locale: string, id: string) => {
    if (getI18nConfig().isDevHotReloadEnabled()) {
      queueRuntimeDictionaryTranslation({ locale, id });
    }
  };

  const translateEntry = (
    suffix: string,
    options: TranslationVariables = {}
  ): string => {
    trackTranslations();
    return resolveDictionaryEntryTranslation({
      id: getId(rootId, suffix),
      options,
      ...resolveConditions(),
      resolveEntry: (locale, id) => getI18nCache().lookupDictionary(locale, id),
      gt,
      onMissingTarget: handleMissingTargetEntry,
    });
  };

  const translateObject = (suffix: string): DictionaryObjectTranslation => {
    trackTranslations();
    return resolveDictionaryObjectTranslation({
      id: getId(rootId, suffix),
      ...resolveConditions(),
      resolveObject: (locale, id) =>
        getI18nCache().lookupDictionaryObj(locale, id),
      gt,
    });
  };

  return Object.assign(translateEntry, { obj: translateObject });
}

function getId(prefix: string | undefined, suffix: string): string {
  return prefix ? `${prefix}.${suffix}` : suffix;
}
