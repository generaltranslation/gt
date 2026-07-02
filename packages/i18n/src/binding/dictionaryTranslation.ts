import { renderDictionaryEntry } from '../translation-functions/internal/renderDictionaryEntry';
import { renderDictionaryObject } from '../translation-functions/internal/renderDictionaryObject';
import { resolveDictionaryLookupOptions } from '../i18n-cache/translations-manager/utils/dictionary-helpers';
import { extractVariables } from '../utils/extractVariables';
import type { DictionaryEntry } from '../i18n-cache/translations-manager/DictionaryCache';
import type {
  DictionaryObjectTranslation,
  GTFunctionType,
} from '../translation-functions/types/functions';
import type { TranslationVariables } from '../translation-functions/types/options';

// Framework-free dictionary resolution shared by the bindings' translation
// functions (react-core's useTranslations, gt-vue's useTranslations). The
// binding supplies its own entry/object resolvers (snapshot-, cache-, or
// tracked-resolver-backed) and miss handling.

/**
 * Resolves a dictionary entry translation: source entry (throws if missing) →
 * target entry when translating (falling back to translating the source
 * string via `gt`).
 */
export function resolveDictionaryEntryTranslation({
  id,
  options = {},
  locale,
  defaultLocale,
  shouldTranslate,
  resolveEntry,
  gt,
  onMissingTarget,
}: {
  id: string;
  options?: TranslationVariables;
  locale: string;
  defaultLocale: string;
  shouldTranslate: boolean;
  resolveEntry: (locale: string, id: string) => DictionaryEntry | undefined;
  gt: GTFunctionType;
  onMissingTarget?: (locale: string, id: string) => void;
}): string {
  const sourceEntry = resolveEntry(defaultLocale, id);
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

  const targetEntry = resolveEntry(locale, id);
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

  onMissingTarget?.(locale, id);
  return gt(sourceEntry.entry, {
    ...sourceOptions,
    ...extractVariables(options),
    $locale: locale,
  });
}

/**
 * Resolves a whole dictionary object translation (throws if the source
 * object is missing).
 */
export function resolveDictionaryObjectTranslation({
  id,
  locale,
  defaultLocale,
  shouldTranslate,
  resolveObject,
  gt,
}: {
  id: string;
  locale: string;
  defaultLocale: string;
  shouldTranslate: boolean;
  resolveObject: (
    locale: string,
    id: string
  ) => Parameters<typeof renderDictionaryObject>[0]['sourceObject'] | undefined;
  gt: GTFunctionType;
}): DictionaryObjectTranslation {
  const sourceObject = resolveObject(defaultLocale, id);
  if (sourceObject === undefined) {
    throw new Error(`Dictionary entry ${id} cannot be found`);
  }

  let targetObject = undefined;
  if (shouldTranslate) {
    targetObject = resolveObject(locale, id);
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
}
