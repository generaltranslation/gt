import { SanityDocument, Schema } from 'sanity';
import {
  BaseDocumentDeserializer,
  BaseDocumentSerializer,
  defaultStopTypes,
  customSerializers,
  customBlockDeserializers,
} from '../serialization/';
import { PortableTextHtmlComponents } from '@portabletext/to-html';
import { pluginConfig } from '../adapter/core';
import merge from 'lodash.merge';

export function deserializeDocument(document: string) {
  const deserializers = merge(
    { types: {} },
    pluginConfig.getAdditionalDeserializers()
  ) satisfies Partial<PortableTextHtmlComponents>;
  const blockDeserializers = [
    ...customBlockDeserializers,
    ...pluginConfig.getAdditionalBlockDeserializers(),
  ];
  const deserialized = BaseDocumentDeserializer.deserializeDocument(
    document,
    deserializers,
    blockDeserializers
  ) as SanityDocument;
  return deserialized;
}

export function serializeDocument(
  document: SanityDocument,
  schema: Schema,
  baseLanguage: string
) {
  const stopTypes = [
    ...defaultStopTypes,
    ...pluginConfig.getAdditionalStopTypes(),
  ];
  const serializers = merge(
    customSerializers,
    pluginConfig.getAdditionalSerializers()
  ) satisfies Partial<PortableTextHtmlComponents>;

  const serialized = BaseDocumentSerializer(schema).serializeDocument(
    document,
    'document',
    baseLanguage,
    stopTypes,
    serializers
  );
  return serialized;
}
