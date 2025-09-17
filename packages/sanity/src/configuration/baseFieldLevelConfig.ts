import { SanityClient, SanityDocument } from 'sanity';
import {
  BaseDocumentSerializer,
  BaseDocumentDeserializer,
  BaseDocumentMerger,
  SerializedDocument,
  defaultStopTypes,
  customSerializers,
  customBlockDeserializers,
} from 'sanity-naive-html-serializer';

import { ExportForTranslation, ImportTranslation } from '../types';
import { findLatestDraft, findDocumentAtRevision } from './utils';

export const fieldLevelPatch = async (
  documentId: string,
  translatedFields: SanityDocument,
  localeId: string,
  client: SanityClient,
  baseLanguage: string = 'en',
  mergeWithTargetLocale: boolean = false
): Promise<void> => {
  let baseDoc: SanityDocument;
  if (translatedFields._rev && translatedFields._id) {
    baseDoc = await findDocumentAtRevision(
      translatedFields._id,
      translatedFields._rev,
      client
    );
  } else {
    baseDoc = await findLatestDraft(documentId, client);
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
  ): Promise<SerializedDocument> => {
    const [id, context, baseLanguage = 'en', serializationOptions = {}] =
      params;
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
    const doc = await findLatestDraft(id, client);
    const serialized = BaseDocumentSerializer(schema).serializeDocument(
      doc,
      'field',
      baseLanguage,
      stopTypes,
      serializers
    );
    serialized.name = id;
    return serialized;
  },
  importTranslation: (
    ...params: Parameters<ImportTranslation>
  ): Promise<void> => {
    const [
      id,
      localeId,
      document,
      context,
      baseLanguage = 'en',
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
      id,
      deserialized,
      localeId,
      client,
      baseLanguage,
      mergeWithTargetLocale
    );
  },
  secretsNamespace: 'translationService',
  baseLanguage: 'en',
};
