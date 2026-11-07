// Adapted from https://github.com/sanity-io/sanity-naive-html-serializer

import { SanityDocument } from 'sanity';
export type CustomDeserializer = (
  element: HTMLElement
) => Record<string, unknown> | unknown[];

export type CustomDeserializers = {
  types?: Record<string, CustomDeserializer>;
} & Record<string, unknown>;

export type SerializedDocument = {
  name: string;
  content: string;
};

// 'document'  – translate the whole document (creates per-locale documents).
// 'internationalizedArray' – sanity-plugin-internationalized-array shape:
//               `title: [{ _key, _type, language, value }]`, localized in place.
export type TranslationLevel = 'document' | 'internationalizedArray';

export interface Deserializer {
  deserializeDocument: <
    TDocument extends Record<string, unknown> = Record<string, unknown>,
  >(
    serializedDoc: string,
    deserializers?: CustomDeserializers,
    blockDeserializers?: Array<unknown>
  ) => TDocument;
  deserializeHTML: (
    html: string,
    deserializers: CustomDeserializers,
    blockDeserializers: Array<unknown>
  ) => Record<string, unknown> | unknown[];
}

export interface Merger {
  documentLevelMerge: <
    TTranslatedFields extends Record<string, unknown>,
    TBaseDoc extends SanityDocument,
  >(
    translatedFields: TTranslatedFields,
    baseDoc: TBaseDoc
  ) => TBaseDoc & TTranslatedFields;
  reconcileArray: (
    origArray: unknown[],
    translatedArray: unknown[]
  ) => unknown[];
  reconcileObject: (
    origObject: Record<string, unknown>,
    translatedObject: Record<string, unknown>
  ) => Record<string, unknown>;
}
