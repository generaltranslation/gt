import { useEffect } from 'react';
import {
  GTProvider as ReactGTProvider,
  type SharedGTProviderProps,
} from 'gt-react';
import { getReactI18nCache } from '@generaltranslation/react-core/pure';
import { getClientReload } from '../setup/initializeGT.client';

export function GTProvider(props: SharedGTProviderProps) {
  const { translations, dictionaries } = props;

  // In production the client i18nCache is TanStack Start's own (see
  // initializeGT.client), and gt-react has no store to fill it. Seed it with
  // the loader data so route loaders that run in the browser during
  // client-side navigation find these translations instead of loading them
  // again. In development the i18nStore keeps the cache up to date.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      const i18nCache = getReactI18nCache();
      i18nCache.updateTranslations(translations);
      i18nCache.updateDictionaries(dictionaries ?? {});
    }
  }, [translations, dictionaries]);

  return (
    <ReactGTProvider {...props} _reload={props._reload ?? getClientReload()} />
  );
}
