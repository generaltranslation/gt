import { SanityDocument, Schema } from 'sanity';
import {
  BaseDocumentDeserializer,
  BaseDocumentSerializer,
  defaultStopTypes,
  customSerializers,
  customBlockDeserializers,
} from '../serialization/';

export function deserializeDocument(document: string) {
  const deserialized = BaseDocumentDeserializer.deserializeDocument(
    document,
    { types: {} },
    customBlockDeserializers
  ) as SanityDocument;
  return deserialized;
}

export function serializeDocument(
  document: SanityDocument,
  schema: Schema,
  baseLanguage: string
) {
  const serialized = BaseDocumentSerializer(schema).serializeDocument(
    document,
    'document',
    baseLanguage,
    defaultStopTypes,
    customSerializers
  );
  return serialized;
}
