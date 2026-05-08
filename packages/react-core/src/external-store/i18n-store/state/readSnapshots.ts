import { getI18nManager } from 'gt-i18n/internal';
import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import type { CustomMapping, IcuMessage } from 'generaltranslation/types';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  TranslationLookup,
  TranslationSnapshot,
} from '../storeTypes';
import type { LookupOptions, Translation } from 'gt-i18n/types';

export function getDefaultLocaleSnapshot(): string {
  return getI18nManager().getDefaultLocale();
}

export function getLocalesSnapshot(): readonly string[] {
  return getI18nManager().getLocales();
}

export function getCustomMappingSnapshot(): CustomMapping {
  return getI18nManager().getCustomMapping();
}

export function getEnableI18nSnapshot(): boolean {
  return getI18nManager().isTranslationEnabled();
}

export function getTranslationSnapshot<T extends Translation>({
  locale,
  message,
  options,
}: TranslationLookup<T>): TranslationSnapshot<T> {
  return getI18nManager().lookupTranslation<T>(locale, message, options);
}

export function getDictionaryEntrySnapshot({
  locale,
  id,
}: DictionaryLookup): DictionaryEntrySnapshot {
  return getI18nManager().lookupDictionary(locale, id);
}

export function getDictionaryObjectSnapshot({
  locale,
  id,
}: DictionaryLookup): DictionaryObjectSnapshot {
  return getI18nManager().lookupDictionaryObj(locale, id);
}

export function getTranslationHash<T extends Translation>(
  message: T,
  options: LookupOptions
): string {
  if (options.$_hash != null) {
    return options.$_hash;
  }

  return hashSource({
    source:
      options.$format === 'ICU' ? indexVars(message as IcuMessage) : message,
    ...(options.$context && { context: options.$context }),
    ...(options.$id && { id: options.$id }),
    ...('$maxChars' in options &&
      options.$maxChars != null && {
        maxChars: Math.abs(options.$maxChars),
      }),
    dataFormat: options.$format,
  });
}
