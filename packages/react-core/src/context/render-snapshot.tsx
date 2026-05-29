import { createContext, useContext, type ReactNode } from 'react';
import {
  getDictionaryEntry,
  getI18nConfig,
  getTranslateListenerKey,
} from 'gt-i18n/internal';
import type {
  Dictionary,
  DictionaryEntry,
  DictionaryObject,
  DictionaryValue,
  Translation,
} from 'gt-i18n/types';
import type { Hash, Locale } from 'gt-i18n/internal/types';
import type {
  DictionaryLookup,
  TranslateLookup,
} from '../i18n-store/storeTypes';

export type RenderSnapshot = {
  translations: Record<Locale, Record<Hash, Translation>>;
  dictionaries: Record<Locale, Dictionary>;
};

const RenderSnapshotContext = createContext<RenderSnapshot | null>(null);

export function RenderSnapshotProvider({
  children,
  value,
}: {
  children?: ReactNode;
  value: RenderSnapshot;
}) {
  return (
    <RenderSnapshotContext.Provider value={value}>
      {children}
    </RenderSnapshotContext.Provider>
  );
}

export function useRenderSnapshot(): RenderSnapshot | null {
  return useContext(RenderSnapshotContext);
}

export function lookupRenderTranslation<T extends Translation>(
  snapshot: RenderSnapshot | null,
  lookup: TranslateLookup<T>
): T | undefined {
  if (!snapshot) return undefined;

  const hash = getTranslateListenerKey(lookup).slice(
    `${lookup.locale}:`.length
  );
  return snapshot.translations[lookup.locale]?.[hash] as T | undefined;
}

export function lookupRenderDictionaryEntry(
  snapshot: RenderSnapshot | null,
  { locale, id }: DictionaryLookup
): DictionaryEntry | undefined {
  const value = lookupRenderDictionaryObject(snapshot, { locale, id });
  return getDictionaryEntry(value);
}

export function lookupRenderDictionaryObject(
  snapshot: RenderSnapshot | null,
  { locale, id }: DictionaryLookup
): DictionaryObject | undefined {
  if (!snapshot) return undefined;

  const dictionaryLocale = getDictionaryLocale(locale);
  const value = getDictionaryValueAtPath(
    snapshot.dictionaries[dictionaryLocale],
    id
  );
  if (value === undefined || typeof value === 'string') {
    return value;
  }
  return structuredClone(value) as DictionaryObject;
}

function getDictionaryLocale(locale: string): string {
  const i18nConfig = getI18nConfig();
  return i18nConfig.requiresTranslation(locale)
    ? locale
    : i18nConfig.getDefaultLocale();
}

function getDictionaryValueAtPath(
  dictionary: Dictionary | undefined,
  id: string
): DictionaryValue | undefined {
  if (!dictionary) return undefined;

  let current: DictionaryValue = dictionary;
  for (const segment of id ? id.split('.') : []) {
    if (
      typeof current !== 'object' ||
      current == null ||
      Array.isArray(current)
    ) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}
