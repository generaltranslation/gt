// Adapted from https://github.com/sanity-io/sanity-naive-html-serializer

import { ObjectField, SanityDocument, TypedObject, Schema } from 'sanity';

export type SerializedDocument = {
  name: string;
  content: string;
};

export type TranslationLevel = 'document' | 'field';
export interface Serializer {
  serializeDocument: (
    doc: SanityDocument,
    translationLevel: TranslationLevel,
    baseLang?: string,
    stopTypes?: string[],
    serializers?: Record<string, any>
  ) => SerializedDocument;
  fieldFilter: (
    obj: Record<string, any>,
    objFields: ObjectField[],
    stopTypes: string[]
  ) => TypedObject;
  languageObjectFieldFilter: (
    obj: Record<string, any>,
    baseLang: string
  ) => Record<string, any>;
  serializeArray: (
    fieldContent: Record<string, any>[],
    fieldName: string,
    stopTypes: string[],
    serializers: Record<string, any>
  ) => string;
  serializeObject: (
    obj: TypedObject,
    stopTypes: string[],
    serializers: Record<string, any>
  ) => string;
}

export type SerializerClosure = (schemas: Schema) => Serializer;

export interface Deserializer {
  deserializeDocument: (
    serializedDoc: string,
    deserializers?: Record<string, any>,
    blockDeserializers?: Array<any>
  ) => Record<string, any>;
  deserializeHTML: (
    html: string,
    deserializers: Record<string, any>,
    blockDeserializers: Array<any>
  ) => Record<string, any> | any[];
}

export interface Merger {
  fieldLevelMerge: (
    translatedFields: Record<string, any>,
    baseDoc: SanityDocument,
    localeId: string,
    baseLang: string
  ) => Record<string, any>;
  documentLevelMerge: (
    translatedFields: Record<string, any>,
    baseDoc: SanityDocument
  ) => Record<string, any>;
  reconcileArray: (origArray: any[], translatedArray: any[]) => any[];
  reconcileObject: (
    origObject: Record<string, any>,
    translatedObject: Record<string, any>
  ) => Record<string, any>;
}
