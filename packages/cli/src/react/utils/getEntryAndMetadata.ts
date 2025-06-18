import { DictionaryEntry, DictionaryMetadata } from '../../types/data.js';

export default function getEntryAndMetadata(value: DictionaryEntry): {
  entry: string;
  metadata?: DictionaryMetadata;
} {
  if (Array.isArray(value)) {
    if (value.length === 1) {
      return { entry: value[0] };
    }
    if (value.length === 2) {
      return { entry: value[0], metadata: value[1] as DictionaryMetadata };
    }
  }
  return { entry: value };
}
