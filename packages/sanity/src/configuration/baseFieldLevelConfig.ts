import { SanityClient, SanityDocument } from 'sanity';
import {
  BaseDocumentSerializer,
  BaseDocumentDeserializer,
  BaseDocumentMerger,
  defaultStopTypes,
  customSerializers,
  customBlockDeserializers,
} from 'sanity-naive-html-serializer';

import type {
  ExportForTranslation,
  GTFile,
  GTSerializedDocument,
  ImportTranslation,
} from '../types';
import { findLatestDraft, findDocumentAtRevision } from './utils';
import { gtConfig } from '../adapter/core';

export const fieldLevelPatch = async (
  docInfo: GTFile,
  translatedFields: SanityDocument,
  localeId: string,
  client: SanityClient,
  mergeWithTargetLocale: boolean = false
): Promise<void> => {
  let baseDoc: SanityDocument;
  const baseLanguage = gtConfig.getSourceLocale();
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
    ...params: Parameters<ExportForTranslation>
  ): Promise<GTSerializedDocument> => {
    const [docInfo, context, serializationOptions = {}] = params;
    const baseLanguage = gtConfig.getSourceLocale();
    const { client, schema } = context;
    const stopTypes = [
      ...(serializationOptions.additionalStopTypes ?? []),
      ...defaultStopTypes,
    ];
    const serializers = {
      ...customSerializers,
      types: {
        ...customSerializers.types,
        ...(serializationOptions.additionalSerializers ?? {}),
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
    ...params: Parameters<ImportTranslation>
  ): Promise<void> => {
    const [
      docInfo,
      localeId,
      document,
      context,
      serializationOptions = {},
      ,
      mergeWithTargetLocale,
    ] = params;
    const { client } = context;
    const deserializers = {
      types: {
        ...(serializationOptions.additionalDeserializers ?? {}),
      },
    };
    const blockDeserializers = [
      ...(serializationOptions.additionalBlockDeserializers ?? []),
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
