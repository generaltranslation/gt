import React from 'react';
import { ClientProvider } from 'gt-react/client';
import { GTProviderProps } from './types';
import { getI18nManager } from 'gt-i18n/internal';

export function GTProvider({
  children,
  translations,
  locale,
}: GTProviderProps): React.ReactNode {
  const i18nManager = getI18nManager();
  return (
    <ClientProvider
      // TODO: dictionary
      dictionary={{}}
      // TODO: dictionaryTranslations
      dictionaryTranslations={{}}
      translations={translations}
      locale={locale}
      locales={locales}
      defaultLocale={defaultLocale}
      translationRequired={translationRequired}
      dialectTranslationRequired={dialectTranslationRequired}
      region={region}
      environment={environment}
      renderSettings={{}}
      developmentApiEnabled={false}
      resetLocaleCookieName={defaultResetLocaleCookieName}
    >
      {children}
    </ClientProvider>
  );
}
