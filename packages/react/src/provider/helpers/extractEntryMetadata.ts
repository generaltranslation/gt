import { DictionaryEntry, Entry, Metadata } from "../../types/types";

export default function extractEntryMetadata(value: DictionaryEntry): {
  entry: Entry;
  metadata?: Metadata;
} {
  if (Array.isArray(value)) {
    if (value.length === 1) {
      return { entry: value[0] };
    }
    if (value.length === 2) {
      return { entry: value[0], metadata: value[1] };
    }
  }
  return { entry: value };
}
