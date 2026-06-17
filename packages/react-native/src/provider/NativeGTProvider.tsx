import {
  I18nStore,
  InternalGTProvider,
  getReactI18nCache,
} from '@generaltranslation/react-core/context';
import { use, useCallback, useMemo, useRef, useState } from 'react';
import type {
  Hash,
  Locale,
  WritableConditionStoreInterface,
} from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';
import { NativeConditionStore } from '../condition-store/NativeConditionStore';
import { getLocale, resolveLocale } from '../utils/getLocale';
import type { GTProviderProps } from './GTProvider';

type NativeGTProviderProps = Omit<GTProviderProps, 'loadingFallback'>;
type LocaleTranslations = Record<Hash, Translation>;
type TranslationSnapshot = Record<Locale, LocaleTranslations>;

const translationPromises = new WeakMap<
  object,
  Map<string, Promise<LocaleTranslations>>
>();

export function NativeGTProvider(props: NativeGTProviderProps) {
  const {
    locale,
    region,
    enableI18n,
    localeStoreKey,
    regionStoreKey,
    enableI18nStoreKey,
    ...providerProps
  } = props;
  const [nativeLocale, setNativeLocale] = useState(() =>
    resolveLocale(locale ?? getLocale({ localeStoreKey }))
  );
  const [conditionVersion, setConditionVersion] = useState(0);
  const activeLocale = resolveLocale(locale ?? nativeLocale);
  const localeTranslations = use(loadTranslations(activeLocale));
  const translations = useMemo<TranslationSnapshot>(
    () => ({ [activeLocale]: localeTranslations }),
    [activeLocale, localeTranslations]
  );

  const i18nStoreRef = useRef<I18nStore | null>(null);
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current = new I18nStore();
  }

  const handleNativeConditionChange = useCallback(
    (nativeConditionStore: NativeConditionStore) => {
      if (locale === undefined) {
        setNativeLocale(nativeConditionStore.getLocale());
      }
      setConditionVersion((version) => version + 1);
    },
    [locale]
  );

  const nativeConditionStore = useMemo(
    () =>
      new NativeConditionStore({
        locale: activeLocale,
        region,
        enableI18n,
        localeStoreKey,
        regionStoreKey,
        enableI18nStoreKey,
      }),
    [
      activeLocale,
      region,
      enableI18n,
      localeStoreKey,
      regionStoreKey,
      enableI18nStoreKey,
    ]
  );

  const conditionStore = useMemo<WritableConditionStoreInterface>(
    () => ({
      getLocale: nativeConditionStore.getLocale,
      getRegion: nativeConditionStore.getRegion,
      getEnableI18n: nativeConditionStore.getEnableI18n,
      setLocale: (nextLocale: string) => {
        nativeConditionStore.setLocale(nextLocale);
        handleNativeConditionChange(nativeConditionStore);
      },
      setRegion: (nextRegion: string | undefined) => {
        nativeConditionStore.setRegion(nextRegion);
        handleNativeConditionChange(nativeConditionStore);
      },
      setEnableI18n: (nextEnableI18n: boolean) => {
        nativeConditionStore.setEnableI18n(nextEnableI18n);
        handleNativeConditionChange(nativeConditionStore);
      },
    }),
    [conditionVersion, handleNativeConditionChange, nativeConditionStore]
  );

  return (
    <InternalGTProvider
      {...providerProps}
      translations={translations}
      conditionStore={conditionStore}
      i18nStore={i18nStoreRef.current}
    />
  );
}

function loadTranslations(locale: string): Promise<LocaleTranslations> {
  const i18nCache = getReactI18nCache();
  let i18nCacheTranslationPromises = translationPromises.get(i18nCache);
  if (i18nCacheTranslationPromises == null) {
    i18nCacheTranslationPromises = new Map();
    translationPromises.set(i18nCache, i18nCacheTranslationPromises);
  }

  let promise = i18nCacheTranslationPromises.get(locale);
  if (promise == null) {
    promise = i18nCache.loadTranslations(locale).catch((error: unknown) => {
      i18nCacheTranslationPromises.delete(locale);
      throw error;
    });
    i18nCacheTranslationPromises.set(locale, promise);
  }
  return promise;
}
