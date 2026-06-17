import {
  getReactI18nCache,
  type InternalGTProviderProps,
} from '@generaltranslation/react-core/context';
import { Suspense, use, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { Hash, LocaleCandidates, Locale } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';
import type {
  NativeConditionStoreParams,
  NativeConditionStoreState,
} from '../condition-store/NativeConditionStore';
import { getLocale, resolveLocale } from '../utils/getLocale';
import { NativeGTProvider } from './NativeGTProvider';

export type GTProviderProps = Omit<
  InternalGTProviderProps,
  'conditionStore' | 'i18nStore' | 'translations'
> &
  Omit<NativeConditionStoreParams, 'locale' | '_reload'> & {
    children?: ReactNode;
    locale?: LocaleCandidates;
    loadingFallback?: ReactNode;
  };

type LoadableGTProviderProps = Omit<GTProviderProps, 'loadingFallback'>;
type LocaleTranslations = Record<Hash, Translation>;
type TranslationSnapshot = Record<Locale, LocaleTranslations>;

const translationPromises = new WeakMap<
  object,
  Map<string, Promise<LocaleTranslations>>
>();

export function GTProvider(props: GTProviderProps) {
  const { loadingFallback, ...providerProps } = props;

  return (
    <Suspense fallback={loadingFallback ?? <DefaultLoadingFallback />}>
      <LoadableGTProvider {...providerProps} />
    </Suspense>
  );
}

function LoadableGTProvider(props: LoadableGTProviderProps) {
  const { locale, localeStoreKey } = props;
  const [nativeLocale, setNativeLocale] = useState(() =>
    getLocale({ localeStoreKey })
  );
  const activeLocale = resolveLocale(locale ?? nativeLocale);
  const localeTranslations = use(loadTranslations(activeLocale));
  const translations = useMemo<TranslationSnapshot>(
    () => ({ [activeLocale]: localeTranslations }),
    [activeLocale, localeTranslations]
  );
  const reload = useCallback(
    (state: NativeConditionStoreState) => {
      if (locale === undefined) {
        setNativeLocale(state.locale);
      }
    },
    [locale]
  );

  return (
    <NativeGTProvider
      {...props}
      locale={activeLocale}
      translations={translations}
      _reload={reload}
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

function DefaultLoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
