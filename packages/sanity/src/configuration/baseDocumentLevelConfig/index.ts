import {
  ExportForTranslation,
  GTSerializedDocument,
  ImportTranslation,
} from '../../types';
import { SanityDocument } from 'sanity';
import { findLatestDraft } from '../utils';
import { documentLevelPatch } from './documentLevelPatch';
import { legacyDocumentLevelPatch } from './legacyDocumentLevelPatch';
import {
  BaseDocumentDeserializer,
  BaseDocumentSerializer,
  defaultStopTypes,
  customSerializers,
  customBlockDeserializers,
} from 'sanity-naive-html-serializer';

export const baseDocumentLevelConfig = {
  exportForTranslation: async (
    ...params: Parameters<ExportForTranslation>
  ): Promise<GTSerializedDocument> => {
    const [
      docInfo,
      context,
      baseLanguage = 'en',
      serializationOptions = {},
      languageField = 'language',
    ] = params;
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
    delete doc[languageField];
    const serialized = BaseDocumentSerializer(schema).serializeDocument(
      doc,
      'document',
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
      baseLanguage = 'en',
      serializationOptions = {},
      languageField = 'language',
      mergeWithTargetLocale = false,
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
    return documentLevelPatch(
      docInfo, // versionId is not used here, since we just use the _rev id in the deserialized HTML itself
      deserialized,
      localeId,
      client,
      baseLanguage,
      languageField,
      mergeWithTargetLocale
    );
  },
  secretsNamespace: 'translationService',
  baseLanguage: 'en',
};

export const legacyDocumentLevelConfig = {
  ...baseDocumentLevelConfig,
  importTranslation: (
    ...params: Parameters<ImportTranslation>
  ): Promise<void> => {
    const [docInfo, localeId, document, context, , serializationOptions = {}] =
      params;
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
    return legacyDocumentLevelPatch(
      docInfo, // versionId is not used here, since we just use the _rev id in the deserialized HTML itself
      deserialized,
      localeId,
      client
    );
  },
};

export { documentLevelPatch, legacyDocumentLevelPatch };
