import { DictionaryEntry, DictionaryMetadata } from '../../types/data';
export default function getEntryAndMetadata(value: DictionaryEntry): {
    entry: string;
    metadata?: DictionaryMetadata;
};
