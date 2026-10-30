import { DictionaryProvider } from '@generaltranslation/react-core/components';
import type { GTDictionaryProviderProps } from './GTDictionaryProviderProps';

/** Client-side GTDictionaryProvider. Owns its dictionary store. */
export function BrowserDictionaryProvider(props: GTDictionaryProviderProps) {
  return <DictionaryProvider {...props} />;
}
