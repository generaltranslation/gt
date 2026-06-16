import {
  I18nStore,
  type InternalGTProviderProps,
  InternalGTProvider,
} from '@generaltranslation/react-core/context';
import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { LocaleCandidates } from 'gt-i18n/internal/types';
import type { NativeConditionStoreParams } from '../condition-store/NativeConditionStore';
import { NativeConditionStore } from '../condition-store/NativeConditionStore';

export type GTProviderProps = Omit<
  InternalGTProviderProps,
  'conditionStore' | 'i18nStore'
> &
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
  } = props;

  const i18nStoreRef = useRef<I18nStore | null>(null);
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current = new I18nStore();
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
