import { SanityDocument, Schema } from 'sanity';
import { BaseDocumentDeserializer } from '../serialization/deserialize/BaseDocumentDeserializer';
import { BaseDocumentSerializer } from '../serialization/serialize/index';
import {
  defaultStopTypes,
  customSerializers,
  customBlockDeserializers,
} from '../serialization/BaseSerializationConfig';
import { PortableTextHtmlComponents } from '@portabletext/to-html';
import { pluginConfig } from '../adapter/core';
import merge from 'lodash.merge';
import { deleteMatchingFields } from './applyDocuments';
import type { FieldMatcher } from '../adapter/types';
import { getPublishedId } from './documentIds';
import type {
  CustomDeserializers,
  TranslationLevel,
} from '../serialization/types';
import { collapseToSourceLocale } from '../serialization/internationalizedArray/collapse';

export function deserializeDocument(document: string) {
  const deserializers = merge(
    { types: {} },
    pluginConfig.getAdditionalDeserializers()
  ) as CustomDeserializers;
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
  baseLanguage: string,
  level: TranslationLevel = 'document'
) {
  const stopTypes = [
    ...defaultStopTypes,
    ...pluginConfig.getAdditionalStopTypes(),
  ];
  const serializers = merge(
    customSerializers,
    pluginConfig.getAdditionalSerializers()
  ) satisfies Partial<PortableTextHtmlComponents>;

  let docToSerialize = stripIgnoredFields(
    document,
    pluginConfig.getIgnoreFields(),
    pluginConfig.getDedupeFields()
  );

  // The internationalized-array model collapses each localized field down to
  // its source-locale value, then serializes through the standard document
  // path so the existing HTML format and deserializer are reused as-is.
  let innerLevel: TranslationLevel = level;
  if (level === 'internationalizedArray') {
    docToSerialize = collapseToSourceLocale(
      docToSerialize,
      baseLanguage
    ) as SanityDocument;
    innerLevel = 'document';
  }

  const serialized = BaseDocumentSerializer(schema).serializeDocument(
    docToSerialize,
    innerLevel,
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
    getPublishedId(document._id),
    strippedDoc,
    fieldsToStrip
  );

  return strippedDoc;
}
