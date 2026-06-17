import {
  InternalGTProvider,
  type InternalGTProviderProps,
} from '@generaltranslation/react-core/components';
import { I18nStore } from '@generaltranslation/react-core/pure';
import { useMemo, useRef } from 'react';
import type { LocaleCandidates } from 'gt-i18n/internal/types';
import type { NativeConditionStoreParams } from '../condition-store/NativeConditionStore';
import { NativeConditionStore } from '../condition-store/NativeConditionStore';

export type NativeGTProviderProps = Omit<
  InternalGTProviderProps,
  'conditionStore' | 'i18nStore'
> &
  Omit<NativeConditionStoreParams, 'locale'> & {
    locale: LocaleCandidates;
  };

export function NativeGTProvider(props: NativeGTProviderProps) {
  const conditionStore = useMemo(() => {
    return new NativeConditionStore(props);
  }, [
    props.locale,
    props.region,
    props.enableI18n,
    props.localeStoreKey,
    props.regionStoreKey,
    props.enableI18nStoreKey,
    props._reload,
  ]);

  const i18nStoreRef = useRef<InternalGTProviderProps['i18nStore'] | null>(
    null
  );
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current =
      new I18nStore() as unknown as InternalGTProviderProps['i18nStore'];
  }

  return (
    <InternalGTProvider
      {...props}
      conditionStore={conditionStore}
      i18nStore={i18nStoreRef.current}
    />
  );
}
