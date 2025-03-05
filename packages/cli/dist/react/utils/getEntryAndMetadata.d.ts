import { DictionaryEntry, Metadata } from '../types';
export default function getEntryAndMetadata(value: DictionaryEntry): {
    entry: string;
    metadata?: Metadata;
};
