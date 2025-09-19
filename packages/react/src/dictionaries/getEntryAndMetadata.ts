import { DictionaryEntry, MetaEntry } from '../types/types';

export default function getEntryAndMetadata(value: DictionaryEntry): {
  entry: string | null;
  metadata?: MetaEntry;
} {
  if (Array.isArray(value)) {
    if (value.length === 1) {
      return { entry: value[0] };
    }
    if (value.length === 2) {
      return { entry: value[0], metadata: value[1] as MetaEntry };
    }
  }
  return { entry: value };
}
