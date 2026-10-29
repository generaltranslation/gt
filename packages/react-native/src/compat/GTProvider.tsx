import {
  DictionaryProvider,
  type DictionaryProviderProps,
} from '@generaltranslation/react-core/components';
import {
  GTProvider as RootGTProvider,
  type GTProviderProps as RootGTProviderProps,
} from '../provider/GTProvider';

/**
 * Props of the `/compat` GTProvider: everything the root GTProvider takes,
 * plus the dictionaries useTranslations() reads.
 *
 * - dictionaries: dictionaries keyed by locale
 * - onMissingDictionaryEntry / onMissingDictionaryObj: override how dev hot
 *   reload handles missing dictionary entries
 */
export type GTProviderProps = RootGTProviderProps &
  Omit<DictionaryProviderProps, 'compatStore' | 'children'>;

/** The root GTProvider plus dictionaries, in a store it owns. */
export function GTProvider({
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
