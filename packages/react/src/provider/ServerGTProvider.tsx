import { I18nStore } from '@generaltranslation/react-core/pure';
import { InternalGTProvider } from '@generaltranslation/react-core/components';
import { useRef } from 'react';
import type { SharedGTProviderProps } from './GTProviderProps';

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
      // Translates during server render, which is impure, because dev hot reload must trigger the translate call on the server to persist translations.
      onMissingTranslation={i18nStoreRef.current.translate}
    />
  );
}

const noopSetLocale = (_locale: string) => undefined;
const noopSetRegion = (_region: string | undefined) => undefined;
const noopSetEnableI18n = (_enabled: boolean) => undefined;
