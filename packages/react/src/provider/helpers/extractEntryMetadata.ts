import {
  DictionaryEntry,
  Entry,
  Metadata,
  TaggedDictionaryEntry,
  TaggedEntry,
} from '../../types/types';

export default function extractEntryMetadata(
  value: DictionaryEntry | TaggedDictionaryEntry
): {
  entry: Entry | TaggedEntry;
  metadata?: Metadata;
} {
  if (Array.isArray(value)) {
    if (value.length === 1) {
      return { entry: value[0] };
    }
    if (value.length === 2) {
      return { entry: value[0], metadata: value[1] as Metadata };
    }
  }
  return { entry: value as Entry | TaggedEntry };
}
