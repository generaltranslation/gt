import {
  I18nStore,
  initializeI18nConfig,
  type InternalGTProviderProps,
  InternalGTProvider,
} from '@generaltranslation/react-core/context';
import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { setupGTServicesEnabled } from 'gt-i18n/internal';
import type {
  GTServicesEnabledParams,
  I18nConfigParams,
  LocaleCandidates,
} from 'gt-i18n/internal/types';
import type { NativeConditionStoreParams } from '../condition-store/NativeConditionStore';
import { NativeConditionStore } from '../condition-store/NativeConditionStore';

export type GTProviderProps = I18nConfigParams &
  GTServicesEnabledParams &
  Omit<InternalGTProviderProps, 'conditionStore' | 'i18nStore'> &
  Omit<NativeConditionStoreParams, 'locale'> & {
    children?: ReactNode;
    locale?: LocaleCandidates;
  };

export function GTProvider(props: GTProviderProps) {
  const {
    locale,
    region,
    enableI18n,
    localeStoreKey,
    regionStoreKey,
    enableI18nStoreKey,
    ...config
  } = props;

  const i18nStoreRef = useRef<I18nStore | null>(null);
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current = new I18nStore();
  }

  const initializedRef = useRef(false);
  if (!initializedRef.current) {
    const providerConfig = {
      ...config,
      locale,
      region,
      enableI18n,
    };
    setupGTServicesEnabled(providerConfig);
    initializeI18nConfig(providerConfig, 'server-render');
    initializedRef.current = true;
  }

  const conditionStore = useMemo(
    () =>
      new NativeConditionStore({
        locale,
        region,
        enableI18n,
        localeStoreKey,
        regionStoreKey,
        enableI18nStoreKey,
      }),
    [
      locale,
      region,
      enableI18n,
      localeStoreKey,
      regionStoreKey,
      enableI18nStoreKey,
    ]
  );

  return (
    <InternalGTProvider
      {...props}
      conditionStore={conditionStore}
      i18nStore={i18nStoreRef.current}
    />
  );
}
