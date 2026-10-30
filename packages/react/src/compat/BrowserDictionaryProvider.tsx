import {
  DictionaryProvider,
  type DictionaryProviderProps,
} from '@generaltranslation/react-core/compat';

/** Client-side dictionary provider. Owns its dictionary store. */
export function BrowserDictionaryProvider(
  props: Omit<DictionaryProviderProps, 'compatStore'>
) {
  return <DictionaryProvider {...props} />;
}
