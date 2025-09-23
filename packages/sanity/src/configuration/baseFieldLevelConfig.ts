// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, SanityDocument } from 'sanity';
import {
  BaseDocumentSerializer,
  BaseDocumentDeserializer,
  BaseDocumentMerger,
  defaultStopTypes,
  customSerializers,
  customBlockDeserializers,
} from '../serialization/';

import type {
  ExportForTranslation,
  GTFile,
  GTSerializedDocument,
  ImportTranslation,
} from '../types';
import { findLatestDraft } from './utils/findLatestDraft';
import { findDocumentAtRevision } from './utils/findDocumentAtRevision';
import { pluginConfig } from '../adapter/core';

export const fieldLevelPatch = async (
  docInfo: GTFile,
  translatedFields: SanityDocument,
  localeId: string,
  client: SanityClient,
  mergeWithTargetLocale: boolean = false
): Promise<void> => {
  let baseDoc: SanityDocument;
  const baseLanguage = pluginConfig.getSourceLocale();
  if (docInfo.documentId && docInfo.versionId) {
    baseDoc = await findDocumentAtRevision(
      docInfo.documentId,
      docInfo.versionId,
      client
    );
  } else {
    baseDoc = await findLatestDraft(docInfo.documentId, client);
  }

  const merged = BaseDocumentMerger.fieldLevelMerge(
    translatedFields,
    baseDoc,
    localeId,
    mergeWithTargetLocale ? baseLanguage : localeId
  );

  await client.patch(baseDoc._id).set(merged).commit();
};

export const baseFieldLevelConfig = {
  exportForTranslation: async (
    docInfo: Parameters<ExportForTranslation>[0],
    context: Parameters<ExportForTranslation>[1]
  ): Promise<GTSerializedDocument> => {
    const baseLanguage = pluginConfig.getSourceLocale();
    const { client, schema } = context;
    const stopTypes = [
      ...pluginConfig.getAdditionalStopTypes(),
      ...defaultStopTypes,
    ];
    const serializers = {
      ...customSerializers,
      types: {
        ...customSerializers.types,
        ...pluginConfig.getAdditionalSerializers(),
      },
    };
    const doc = await findLatestDraft(docInfo.documentId, client);
    const serialized = BaseDocumentSerializer(schema).serializeDocument(
      doc,
      'field',
      baseLanguage,
      stopTypes,
      serializers
    );
    return {
      content: serialized.content,
      documentId: docInfo.documentId,
      versionId: docInfo.versionId,
    };
  },
  importTranslation: (
    docInfo: Parameters<ImportTranslation>[0],
    localeId: Parameters<ImportTranslation>[1],
    document: Parameters<ImportTranslation>[2],
    context: Parameters<ImportTranslation>[3],
    mergeWithTargetLocale: boolean = false
  ): Promise<void> => {
    const { client } = context;
    const deserializers = {
      types: {
        ...pluginConfig.getAdditionalDeserializers(),
      },
    };
    const blockDeserializers = [
      ...pluginConfig.getAdditionalBlockDeserializers(),
      ...customBlockDeserializers,
    ];

    const deserialized = BaseDocumentDeserializer.deserializeDocument(
      document,
      deserializers,
      blockDeserializers
    ) as SanityDocument;
    return fieldLevelPatch(
      docInfo,
      deserialized,
      localeId,
      client,
      mergeWithTargetLocale
    );
  },
  secretsNamespace: 'translationService',
};
