import { withLocaleTwinReload } from '@generaltranslation/react-core/internal/experimental';
import { useMemo } from 'react';
import { BrowserGTProvider as RegularBrowserGTProvider } from '../../provider/BrowserGTProvider';
import { NO_TRANSLATIONS, type SharedGTProviderProps } from './GTProviderProps';

/**
 * The client GTProvider with locale twins: a locale switch on a twin client
 * loads a new document (a custom `_reload` that does not navigate is
 * followed by a document reload), and no translations snapshot is needed.
 */
export function BrowserGTProvider({
  translations = NO_TRANSLATIONS,
  _reload,
  ...props
}: SharedGTProviderProps) {
  const reload = useMemo(() => withLocaleTwinReload(_reload), [_reload]);
  return (
    <RegularBrowserGTProvider
      {...props}
      translations={translations}
      _reload={reload}
    />
  );
}
