import { DictionaryProvider } from '@generaltranslation/react-core/compat';
import type { GTDictionaryProviderProps } from './GTDictionaryProviderProps';

/** Client-side GTDictionaryProvider. Owns its dictionary store. */
export function BrowserDictionaryProvider(props: GTDictionaryProviderProps) {
  return <DictionaryProvider {...props} />;
}
