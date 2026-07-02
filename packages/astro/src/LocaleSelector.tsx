import type React from 'react';
import { InternalLocaleSelector } from '@generaltranslation/react-core/components';
import type { CustomMapping } from 'generaltranslation/types';
import { defaultLocaleCookieName, useLocaleSelector } from 'gt-react';
import { getLocalizedPath } from './utils';

export type LocaleSelectorProps = {
  locales?: string[];
  customMapping?: CustomMapping;
  [key: string]: unknown;
};

/**
 * A dropdown that switches the locale by persisting the locale cookie and
 * navigating to the locale-prefixed equivalent of the current path. Must be
 * rendered inside a `<GTProvider>` island.
 */
export function LocaleSelector({
  locales: _locales,
  ...props
}: LocaleSelectorProps): React.JSX.Element | null {
  const { locale, locales, getLocaleProperties } = useLocaleSelector(_locales);

  const selectLocale = (nextLocale: string) => {
    document.cookie = `${defaultLocaleCookieName}=${nextLocale};path=/;max-age=31536000;samesite=lax`;
    window.location.assign(
      getLocalizedPath(window.location.pathname, nextLocale, locales) +
        window.location.search
    );
  };

  return (
    <InternalLocaleSelector
      locale={locale}
      locales={locales}
      setLocale={selectLocale}
      getLocaleProperties={getLocaleProperties}
      {...props}
    />
  );
}
