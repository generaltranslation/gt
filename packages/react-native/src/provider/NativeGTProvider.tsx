import {
  InternalGTProvider,
  type InternalGTProviderProps,
} from '@generaltranslation/react-core/components';
import { useMemo } from 'react';
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
  }, [props.locale, props.region, props.enableI18n, props._reload]);

  return <InternalGTProvider {...props} conditionStore={conditionStore} />;
}
