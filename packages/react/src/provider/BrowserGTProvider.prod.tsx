import { InternalGTProvider } from '@generaltranslation/react-core/components';
import { setClientSnapshots } from '@generaltranslation/react-core/pure';
import { useMemo } from 'react';
import { createOrUpdateBrowserConditionStore } from '../condition-store/createBrowserConditionStore';
import type { SharedGTProviderProps } from './GTProviderProps';

export function BrowserGTProviderProd(props: SharedGTProviderProps) {
  setClientSnapshots(props.translations, props.dictionaries ?? {});

  const conditionStore = useMemo(
    () => createOrUpdateBrowserConditionStore(props),
    [props.locale, props.region, props.enableI18n, props._reload]
  );

  return <InternalGTProvider {...props} conditionStore={conditionStore} />;
}
