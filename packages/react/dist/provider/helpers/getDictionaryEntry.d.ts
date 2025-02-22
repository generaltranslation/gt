import { Dictionary, DictionaryEntry } from '../../types/types';
export declare function isValidDictionaryEntry(value: unknown): value is DictionaryEntry;
export default function getDictionaryEntry<T extends Dictionary>(dictionary: T, id: string): Dictionary | DictionaryEntry | undefined;
//# sourceMappingURL=getDictionaryEntry.d.ts.map