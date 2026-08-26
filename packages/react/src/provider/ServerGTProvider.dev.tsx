import {
  I18nStore,
  InternalGTProvider,
} from '@generaltranslation/react-core/components';
import { ReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import { useMemo, useRef } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';
import { useHandleMissingTranslations } from '../hooks/useHandleMissingTranslations';
import { syncI18nCache } from './syncI18nCache';

export function ServerGTProviderDev({
  locale,
  region,
  enableI18n,
  ...props
}: SharedGTProviderProps) {
  syncI18nCache(props);

  const conditionStore = useMemo(
    () => new ReadonlyConditionStore({ locale, region, enableI18n }),
    [locale, region, enableI18n]
  );
  const i18nStoreRef = useRef<I18nStore | null>(null);
  if (i18nStoreRef.current == null) i18nStoreRef.current = new I18nStore();

  const missingHandlers = useHandleMissingTranslations(i18nStoreRef.current);

  return (
    <InternalGTProvider
      {...props}
      {...missingHandlers}
      conditionStore={conditionStore}
      i18nStore={i18nStoreRef.current}
    />
  );
}
