import { TaggedChildren, TranslationError, Metadata } from "gt-react/internal";

export type TaggedEntry = string | TaggedChildren;
export type TaggedDictionaryEntry = TaggedEntry | [ TaggedEntry ] | [ TaggedEntry, Metadata ];
export type TaggedDictionary = {
    [key: string]: TaggedDictionary | TaggedDictionaryEntry;
}
export type FlattenedTaggedDictionary = {
    [key: string]: TaggedDictionaryEntry
}

export class GTTranslationError extends Error {
  constructor(public error: string, public code: number) {
    super(error);
    this.code = code;
  }

  toTranslationError(): TranslationError {
    return {
      state: 'error',
      error: this.error,
      code: this.code
    }
  }
}