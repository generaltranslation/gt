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
import { deleteMatchingFields } from './applyDocuments';
import type { FieldMatcher } from '../adapter/types';

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

  const docToSerialize = stripIgnoredFields(
    document,
    pluginConfig.getIgnoreFields(),
    pluginConfig.getDedupeFields()
  );

  const serialized = BaseDocumentSerializer(schema).serializeDocument(
    docToSerialize,
    'document',
    baseLanguage,
    stopTypes,
    serializers
  );
  return serialized;
}

function stripIgnoredFields(
  document: SanityDocument,
  ignoreFields: FieldMatcher[],
  dedupeFields: FieldMatcher[]
): SanityDocument {
  const fieldsToStrip = [...ignoreFields, ...dedupeFields];
  if (fieldsToStrip.length === 0) return document;

  const strippedDoc = JSON.parse(JSON.stringify(document)) as SanityDocument;

  deleteMatchingFields(
    document._id.replace('drafts.', ''),
    strippedDoc,
    fieldsToStrip
  );

  return strippedDoc;
}
