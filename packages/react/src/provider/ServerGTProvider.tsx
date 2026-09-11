import {
  I18nStore,
  InternalGTProvider,
} from '@generaltranslation/react-core/components';
import { ReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import { useMemo, useRef } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';
import { useHandleMissingTranslations } from '../hooks/useHandleMissingTranslations';

/**
 * Consumes snapshot from server
 * Implementation for server-side only
 */
export function ServerGTProvider(props: SharedGTProviderProps) {
  const { locale, region, enableI18n } = props;
  const conditionStore = useMemo(() => {
    return new ReadonlyConditionStore({ locale, region, enableI18n });
  }, [locale, region, enableI18n]);

  return process.env.NODE_ENV === 'production' ? (
    <InternalGTProvider {...props} conditionStore={conditionStore} />
  ) : (
    <ServerGTProviderDev {...props} conditionStore={conditionStore} />
  );
}

function ServerGTProviderDev({
  conditionStore,
  ...props
}: SharedGTProviderProps & { conditionStore: ReadonlyConditionStore }) {
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
