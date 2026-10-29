'server-only';

import { CompatStore } from '@generaltranslation/react-core/pure';
import {
  DictionaryProvider,
  type DictionaryProviderProps,
} from '@generaltranslation/react-core/components';
import { useMemo, useRef } from 'react';
import type { GTDictionaryProviderProps } from './GTDictionaryProviderProps';

/**
 * Server-side DictionaryProvider. Missing dictionary entries are translated
 * during render: the server has no effects, and dev hot reload MUST trigger
 * the translate call on the server to persist translations.
 */
export function ServerDictionaryProvider(props: GTDictionaryProviderProps) {
  const compatStoreRef = useRef<CompatStore | null>(null);
  if (compatStoreRef.current == null) {
    compatStoreRef.current = new CompatStore();
  }
  const compatStore = compatStoreRef.current;
  const handlers = useMemo<
    Pick<
      DictionaryProviderProps,
      'onMissingDictionaryEntry' | 'onMissingDictionaryObj'
    >
  >(
    () => ({
      onMissingDictionaryEntry: (lookup) =>
        compatStore.translateDictionaryEntry(lookup),
      onMissingDictionaryObj: (lookup) =>
        compatStore.translateDictionaryObject(lookup),
    }),
    [compatStore]
  );

  return (
    <DictionaryProvider {...props} compatStore={compatStore} {...handlers} />
  );
}
