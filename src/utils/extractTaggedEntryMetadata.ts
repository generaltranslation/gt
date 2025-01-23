import { Metadata } from "gt-react/internal";
import { TaggedDictionaryEntry, TaggedEntry } from "../types/types";

export default function extractEntryMetadata(value: TaggedDictionaryEntry): {
    entry: TaggedEntry,
    metadata?: Metadata 
} {
    if (Array.isArray(value)) {
        if (value.length === 1) {
            return { entry: value[0] }
        }
        if (value.length === 2) {
            return { entry: value[0], metadata: value[1] as Metadata }
        }
    }
    return { entry: value as TaggedEntry };
}