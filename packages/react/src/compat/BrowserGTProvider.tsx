import { BrowserGTProvider as RootGTProvider } from '../provider/BrowserGTProvider';
import { DictionaryProvider } from '@generaltranslation/react-core/compat';
import type { GTProviderProps } from './GTProviderProps';

/** Client-side `/compat` GTProvider: the root provider plus dictionaries. */
export function BrowserGTProvider({
  dictionaries,
  onMissingDictionaryEntry,
  onMissingDictionaryObj,
  children,
  ...props
}: GTProviderProps) {
  return (
    <RootGTProvider {...props}>
      <DictionaryProvider
        dictionaries={dictionaries}
        onMissingDictionaryEntry={onMissingDictionaryEntry}
        onMissingDictionaryObj={onMissingDictionaryObj}
      >
        {children}
      </DictionaryProvider>
    </RootGTProvider>
  );
}
