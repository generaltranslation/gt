import { ServerGTProvider as RootGTProvider } from '../provider/ServerGTProvider';
import { ServerDictionaryProvider } from './ServerDictionaryProvider';
import type { GTProviderProps } from './GTProviderProps';

/** Server-side `/compat` GTProvider: the root provider plus dictionaries. */
export function ServerGTProvider({
  dictionaries,
  onMissingDictionaryEntry,
  onMissingDictionaryObj,
  children,
  ...props
}: GTProviderProps) {
  return (
    <RootGTProvider {...props}>
      <ServerDictionaryProvider
        dictionaries={dictionaries}
        onMissingDictionaryEntry={onMissingDictionaryEntry}
        onMissingDictionaryObj={onMissingDictionaryObj}
      >
        {children}
      </ServerDictionaryProvider>
    </RootGTProvider>
  );
}
