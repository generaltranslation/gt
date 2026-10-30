'use client';

import {
  GTDictionaryProvider,
  type GTDictionaryProviderProps,
} from 'gt-react/compat';

/**
 * Client boundary for the RSC GTDictionaryProvider. Only here can the bundler
 * pick gt-react's client or server-rendering GTDictionaryProvider.
 */
export function Client_GTDictionaryProvider(props: GTDictionaryProviderProps) {
  return <GTDictionaryProvider {...props} />;
}
