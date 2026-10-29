import { BrowserGTProvider as RootGTProvider } from '../provider/BrowserGTProvider';
import { BrowserDictionaryProvider } from './BrowserDictionaryProvider';
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
      <BrowserDictionaryProvider
        dictionaries={dictionaries}
        onMissingDictionaryEntry={onMissingDictionaryEntry}
        onMissingDictionaryObj={onMissingDictionaryObj}
      >
        {children}
      </BrowserDictionaryProvider>
    </RootGTProvider>
  );
}
