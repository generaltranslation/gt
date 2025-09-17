import { ExportForTranslation, ImportTranslation } from '../../types';
import { SanityDocument } from 'sanity';
import { findLatestDraft } from '../utils';
import { documentLevelPatch } from './documentLevelPatch';
import { legacyDocumentLevelPatch } from './legacyDocumentLevelPatch';
import {
  SerializedDocument,
  BaseDocumentDeserializer,
  BaseDocumentSerializer,
  defaultStopTypes,
  customSerializers,
  customBlockDeserializers,
} from 'sanity-naive-html-serializer';

export const baseDocumentLevelConfig = {
  exportForTranslation: async (
    ...params: Parameters<ExportForTranslation>
  ): Promise<SerializedDocument> => {
    const [
      id,
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
    const doc = await findLatestDraft(id, client);
    delete doc[languageField];
    const serialized = BaseDocumentSerializer(schema).serializeDocument(
      doc,
      'document',
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
      id,
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
    const [id, localeId, document, context, , serializationOptions = {}] =
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
    return legacyDocumentLevelPatch(id, deserialized, localeId, client);
  },
};

export { documentLevelPatch, legacyDocumentLevelPatch };
