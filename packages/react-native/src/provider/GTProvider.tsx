import type { InternalGTProviderProps } from '@generaltranslation/react-core/context';
import { Suspense, use, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { LocaleCandidates, Locale } from 'gt-i18n/internal/types';
import type {
  NativeConditionStoreParams,
  NativeConditionStoreState,
} from '../condition-store/NativeConditionStore';
import { getLocale, resolveLocale } from '../utils/getLocale';
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

function LoadableGTProvider(props: LoadableGTProviderProps) {
  const { locale, localeStoreKey } = props;
  // Keep the native locale in React state so condition-store writes trigger rerenders.
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
