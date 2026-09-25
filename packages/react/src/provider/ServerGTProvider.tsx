import {
  I18nStore,
  InternalGTProvider,
} from '@generaltranslation/react-core/components';
import { useRef } from 'react';
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
      locale={locale}
      region={region}
      enableI18n={enableI18n ?? true}
      setLocale={noopSetLocale}
      setRegion={noopSetRegion}
      setEnableI18n={noopSetEnableI18n}
      i18nStore={i18nStoreRef.current}
      onMissingTranslation={onMissingTranslation}
      onMissingDictionaryEntry={onMissingDictionaryEntry}
      onMissingDictionaryObj={onMissingDictionaryObj}
    />
  );
}

const noopSetLocale = (_locale: string) => undefined;
const noopSetRegion = (_region: string | undefined) => undefined;
const noopSetEnableI18n = (_enabled: boolean) => undefined;
