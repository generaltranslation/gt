import type { InternalGTProviderProps } from '@generaltranslation/react-core/components';
import { Suspense, use, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { LocaleCandidates, Locale } from 'gt-i18n/internal/types';
import type {
  NativeConditionStoreParams,
  NativeConditionStoreState,
} from '../condition-store/NativeConditionStore';
import { getLocale } from '../utils/getLocale';
import {
  getInitialEnableI18n,
  getInitialRegion,
} from '../utils/getInitialNativeConditions';
import { resolveLocale } from '../utils/resolveLocale';
import { loadTranslations, type LocaleTranslations } from './loadTranslations';
import {
  NativeGTProvider,
  type NativeGTProviderProps,
} from './NativeGTProvider';

export type GTProviderProps = Omit<
  InternalGTProviderProps,
  'conditionStore' | 'i18nStore' | 'translations'
> &
  Omit<NativeConditionStoreParams, 'locale' | '_reload'> & {
    children?: ReactNode;
    locale?: LocaleCandidates;
    loadingFallback?: ReactNode;
  };

type LoadedGTProviderProps = Omit<NativeGTProviderProps, 'translations'>;
type TranslationSnapshot = Record<Locale, LocaleTranslations>;

export function GTProvider(props: GTProviderProps) {
  return <LoadableGTProvider {...props} />;
}

/**
 * This wrapper takes the place of a loader that would be present in
 * SSR style applications.
 */
function LoadableGTProvider(props: GTProviderProps) {
  const { loadingFallback, ...providerProps } = props;
  const fallback = loadingFallback ?? <DefaultLoadingFallback />;
  const { locale, region, enableI18n } = providerProps;
  // Keep native conditions in React state so condition-store writes trigger rerenders.
  const [nativeConditions, setNativeConditions] =
    useState<NativeConditionStoreState>(() => ({
      locale: getLocale(),
      region: getInitialRegion({ region }),
      enableI18n: getInitialEnableI18n({ enableI18n }),
    }));
  const activeLocale = resolveLocale(locale ?? nativeConditions.locale);
  const activeRegion = region ?? nativeConditions.region;
  const activeEnableI18n = enableI18n ?? nativeConditions.enableI18n;
  const fallbackTranslations = useMemo<TranslationSnapshot>(
    () => ({ [activeLocale]: {} }),
    [activeLocale]
  );
  const reload = useCallback(
    (state: NativeConditionStoreState) => {
      setNativeConditions((previousState) => ({
        locale: locale === undefined ? state.locale : previousState.locale,
        region: region === undefined ? state.region : previousState.region,
        enableI18n:
          enableI18n === undefined
            ? state.enableI18n
            : previousState.enableI18n,
      }));
    },
    [enableI18n, locale, region]
  );

  return (
    <Suspense
      fallback={
        <NativeGTProvider
          {...providerProps}
          locale={activeLocale}
          region={activeRegion}
          enableI18n={activeEnableI18n}
          translations={fallbackTranslations}
          _reload={reload}
        >
          {fallback}
        </NativeGTProvider>
      }
    >
      <LoadedGTProvider
        {...providerProps}
        locale={activeLocale}
        region={activeRegion}
        enableI18n={activeEnableI18n}
        _reload={reload}
      />
    </Suspense>
  );
}

function LoadedGTProvider(props: LoadedGTProviderProps) {
  const activeLocale = resolveLocale(props.locale);
  const localeTranslations = use(loadTranslations(activeLocale));
  const translations = useMemo<TranslationSnapshot>(
    () => ({ [activeLocale]: localeTranslations }),
    [activeLocale, localeTranslations]
  );

  return (
    <NativeGTProvider
      {...props}
      locale={activeLocale}
      translations={translations}
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
