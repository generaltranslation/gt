import {
  I18nStore,
  type InternalGTProviderProps,
  InternalGTProvider,
  getTranslationsSnapshot,
} from '@generaltranslation/react-core/context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type {
  LocaleCandidates,
  WritableConditionStoreInterface,
} from 'gt-i18n/internal/types';
import type { NativeConditionStoreParams } from '../condition-store/NativeConditionStore';
import { NativeConditionStore } from '../condition-store/NativeConditionStore';
import { getLocale, resolveLocale } from '../utils/getLocale';

export type GTProviderProps = Omit<
  InternalGTProviderProps,
  'conditionStore' | 'i18nStore' | 'translations'
> &
  Omit<NativeConditionStoreParams, 'locale'> & {
    children?: ReactNode;
    locale?: LocaleCandidates;
    loadingFallback?: ReactNode;
  };

type TranslationSnapshot = Awaited<ReturnType<typeof getTranslationsSnapshot>>;

type LoadedTranslations = {
  locale: string;
  translations?: TranslationSnapshot;
  error?: unknown;
};

export function GTProvider(props: GTProviderProps) {
  const {
    locale,
    region,
    enableI18n,
    localeStoreKey,
    regionStoreKey,
    enableI18nStoreKey,
    loadingFallback,
    ...providerProps
  } = props;
  const [nativeLocale, setNativeLocale] = useState(() =>
    resolveLocale(locale ?? getLocale({ localeStoreKey }))
  );
  const [conditionVersion, setConditionVersion] = useState(0);
  const activeLocale = resolveLocale(locale ?? nativeLocale);
  const [loadedTranslations, setLoadedTranslations] =
    useState<LoadedTranslations | null>(null);

  const i18nStoreRef = useRef<I18nStore | null>(null);
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current = new I18nStore();
  }

  useEffect(() => {
    if (locale !== undefined) return;
    setNativeLocale(getLocale({ localeStoreKey }));
  }, [locale, localeStoreKey]);

  useEffect(() => {
    let isActive = true;

    void getTranslationsSnapshot(activeLocale)
      .then((translations) => {
        if (!isActive) return;
        setLoadedTranslations({ locale: activeLocale, translations });
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setLoadedTranslations({ locale: activeLocale, error });
      });

    return () => {
      isActive = false;
    };
  }, [activeLocale]);

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

  if (loadedTranslations?.locale === activeLocale && loadedTranslations.error) {
    throw loadedTranslations.error;
  }

  if (
    loadedTranslations?.locale !== activeLocale ||
    loadedTranslations.translations == null
  ) {
    return loadingFallback ?? <DefaultLoadingFallback />;
  }

  return (
    <InternalGTProvider
      {...providerProps}
      translations={loadedTranslations.translations}
      conditionStore={conditionStore}
      i18nStore={i18nStoreRef.current}
    />
  );
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
