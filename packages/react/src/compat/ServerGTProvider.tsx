import { ServerGTProvider as RootGTProvider } from '../provider/ServerGTProvider';
import { ServerDictionaryProvider } from './ServerDictionaryProvider';
import type { GTProviderProps } from './GTProviderProps';

/** Server-side `/compat` GTProvider: the root provider plus dictionaries. */
export function ServerGTProvider({
  dictionaries,
  children,
  ...props
}: GTProviderProps) {
  return (
    <RootGTProvider {...props}>
      <ServerDictionaryProvider dictionaries={dictionaries}>
        {children}
      </ServerDictionaryProvider>
    </RootGTProvider>
  );
}
