import type { InternalGTProviderProps } from '@generaltranslation/react-core/context';
import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { LocaleCandidates } from 'gt-i18n/internal/types';
import type { NativeConditionStoreParams } from '../condition-store/NativeConditionStore';
import { NativeGTProvider } from './NativeGTProvider';

export type GTProviderProps = Omit<
  InternalGTProviderProps,
  'conditionStore' | 'i18nStore' | 'translations'
> &
  Omit<NativeConditionStoreParams, 'locale'> & {
    children?: ReactNode;
    locale?: LocaleCandidates;
    loadingFallback?: ReactNode;
  };

export function GTProvider(props: GTProviderProps) {
  const { loadingFallback, ...providerProps } = props;

  return (
    <Suspense fallback={loadingFallback ?? <DefaultLoadingFallback />}>
      <NativeGTProvider {...providerProps} />
    </Suspense>
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
