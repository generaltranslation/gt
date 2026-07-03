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
type TranslationSnapshot = Record<Locale, LocaleTranslations>;

export function GTProvider(props: GTProviderProps) {
  const { loadingFallback, ...providerProps } = props;

  return (
    <Suspense fallback={loadingFallback ?? <DefaultLoadingFallback />}>
      <LoadableGTProvider {...providerProps} />
    </Suspense>
  );
}

/**
 * This wrapper takes the place of a loader that would be present in
 * SSR style applications.
 */
function LoadableGTProvider(props: LoadableGTProviderProps) {
  const { locale, region, enableI18n } = props;
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
  const localeTranslations = use(loadTranslations(activeLocale));
  const translations = useMemo<TranslationSnapshot>(
    () => ({ [activeLocale]: localeTranslations }),
    [activeLocale, localeTranslations]
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
    <NativeGTProvider
      {...props}
      locale={activeLocale}
      region={activeRegion}
      enableI18n={activeEnableI18n}
      translations={translations}
      _reload={reload}
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
