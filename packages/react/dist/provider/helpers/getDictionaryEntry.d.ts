import { Dictionary, DictionaryEntry, FlattenedDictionary } from '../../types/types';
export default function getDictionaryEntry<T extends Dictionary | FlattenedDictionary>(dictionary: T, id: string): T extends FlattenedDictionary ? DictionaryEntry | undefined : Dictionary | DictionaryEntry | undefined;
//# sourceMappingURL=getDictionaryEntry.d.ts.map