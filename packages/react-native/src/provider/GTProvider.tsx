import type { InternalGTProviderProps } from '@generaltranslation/react-core/components';
import { Suspense, use, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { LocaleCandidates, Locale } from 'gt-i18n/internal';
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
  | 'i18nStore'
  | 'translations'
  | 'locale'
  | 'region'
  | 'enableI18n'
  | 'setLocale'
  | 'setRegion'
  | 'setEnableI18n'
> &
  Omit<NativeConditionStoreParams, 'locale' | '_reload'> & {
    children?: ReactNode;
    locale?: LocaleCandidates;
    fallback?: ReactNode;
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
  const { fallback, ...providerProps } = props;
  const renderedFallback = fallback ?? <DefaultLoadingFallback />;
  const { locale, region, enableI18n } = providerProps;
  // Keep native conditions in React state so condition-store writes trigger rerenders.
  const [nativeConditions, setNativeConditions] =
    useState<NativeConditionStoreState>(() => ({
      locale: getLocale(),
      region: getInitialRegion({ region }),
      enableI18n: getInitialEnableI18n({ enableI18n }),
    }));
  const activeLocale = resolveLocale(locale ?? nativeConditions.locale);
  // An empty region is no region, as it is when read back from storage.
  const activeRegion = (region ?? nativeConditions.region) || undefined;
  const activeEnableI18n = enableI18n ?? nativeConditions.enableI18n;
  const fallbackTranslations = useMemo<TranslationSnapshot>(
    () => ({ [activeLocale]: {} }),
    [activeLocale]
  );
  // A setter reports the one condition it changed, so a setter kept from an
  // earlier render cannot bring the other two back. A prop takes the place of
  // the matching condition, so a change to it is not kept.
  const reload = useCallback(
    (change: Partial<NativeConditionStoreState>) => {
      setNativeConditions((previousState) => ({
        locale:
          locale === undefined && change.locale !== undefined
            ? change.locale
            : previousState.locale,
        region:
          region === undefined && 'region' in change
            ? change.region
            : previousState.region,
        enableI18n:
          enableI18n === undefined && change.enableI18n !== undefined
            ? change.enableI18n
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
          {renderedFallback}
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
