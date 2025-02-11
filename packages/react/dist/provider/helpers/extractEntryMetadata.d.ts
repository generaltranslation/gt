import { DictionaryEntry, Entry, Metadata, TaggedDictionaryEntry, TaggedEntry } from '../../types/types';
export default function extractEntryMetadata(value: DictionaryEntry | TaggedDictionaryEntry): {
    entry: Entry | TaggedEntry;
    metadata?: Metadata;
};
//# sourceMappingURL=extractEntryMetadata.d.ts.map