'server-only';

import {
  CompatStore,
  DictionaryProvider,
  type DictionaryProviderProps,
} from '@generaltranslation/react-core/compat';
import { useRef } from 'react';

/**
 * Server-side DictionaryProvider. Missing dictionary entries are translated
 * during render: the server has no effects, and dev hot reload MUST trigger
 * the translate call on the server to persist translations.
 */
export function ServerDictionaryProvider({
  dictionaries,
  children,
}: Pick<DictionaryProviderProps, 'dictionaries' | 'children'>) {
  const compatStoreRef = useRef<CompatStore | null>(null);
  if (compatStoreRef.current == null) {
    compatStoreRef.current = new CompatStore();
  }
  const compatStore = compatStoreRef.current;

  return (
    <DictionaryProvider
      dictionaries={dictionaries}
      compatStore={compatStore}
      onMissingDictionaryEntry={compatStore.translateDictionaryEntry}
      onMissingDictionaryObj={compatStore.translateDictionaryObject}
    >
      {children}
    </DictionaryProvider>
  );
}
