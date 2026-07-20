import {
  I18nStore,
  InternalGTProvider,
} from '@generaltranslation/react-core/components';
import {
  getReadonlyConditionStore,
  isReadonlyConditionStoreInitialized,
  ReadonlyConditionStore,
} from '@generaltranslation/react-core/pure';
import { useMemo, useRef } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';
import { useHandleMissingTranslations } from '../hooks/useHandleMissingTranslations';

/**
 * Consumes snapshot from server
 * Implementation for server-side only
 */
export function ServerGTProvider({
  locale,
  region,
  enableI18n,
  ...props
}: SharedGTProviderProps) {
  const conditionStore = useMemo(() => {
    if (isReadonlyConditionStoreInitialized()) {
      return getReadonlyConditionStore();
    }
    return new ReadonlyConditionStore({ locale, region, enableI18n });
  }, [locale, region, enableI18n]);

  const i18nStoreRef = useRef<I18nStore | null>(null);
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current = new I18nStore();
  }

  const {
    onMissingTranslation,
    onMissingDictionaryEntry,
    onMissingDictionaryObj,
  } = useHandleMissingTranslations(i18nStoreRef.current);

  return (
    <InternalGTProvider
      {...props}
      conditionStore={conditionStore}
      i18nStore={i18nStoreRef.current}
      onMissingTranslation={onMissingTranslation}
      onMissingDictionaryEntry={onMissingDictionaryEntry}
      onMissingDictionaryObj={onMissingDictionaryObj}
    />
  );
}
