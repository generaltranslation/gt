import { I18nStore } from '@generaltranslation/react-core/pure';
import { InternalGTProvider } from '@generaltranslation/react-core/components';
import { useRef } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';
import { useHandleMissingTranslations } from '../hooks/useHandleMissingTranslations';
import { ServerDictionaryProvider } from '../compat/ServerDictionaryProvider';

/**
 * Consumes snapshot from server
 * Implementation for server-side only
 */
export function ServerGTProvider({
  locale,
  region,
  enableI18n,
  // shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
  dictionaries,
  onMissingDictionaryEntry: _onMissingDictionaryEntry,
  onMissingDictionaryObj: _onMissingDictionaryObj,
  children,
  ...props
}: SharedGTProviderProps) {
  const i18nStoreRef = useRef<I18nStore | null>(null);
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current = new I18nStore();
  }

  const { onMissingTranslation } = useHandleMissingTranslations(
    i18nStoreRef.current
  );

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
    >
      {/* shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries */}
      <ServerDictionaryProvider dictionaries={dictionaries}>
        {children}
      </ServerDictionaryProvider>
    </InternalGTProvider>
  );
}

const noopSetLocale = (_locale: string) => undefined;
const noopSetRegion = (_region: string | undefined) => undefined;
const noopSetEnableI18n = (_enabled: boolean) => undefined;
