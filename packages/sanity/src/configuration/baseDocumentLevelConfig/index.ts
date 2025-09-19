// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import {
  ExportForTranslation,
  GTSerializedDocument,
  ImportTranslation,
} from '../../types';
import { SanityDocument } from 'sanity';
import { findLatestDraft } from '../utils/findLatestDraft';
import { documentLevelPatch } from './documentLevelPatch';
import {
  BaseDocumentDeserializer,
  BaseDocumentSerializer,
  defaultStopTypes,
  customSerializers,
  customBlockDeserializers,
} from 'sanity-naive-html-serializer';
import { gtConfig } from '../../adapter/core';

export const baseDocumentLevelConfig = {
  exportForTranslation: async (
    ...params: Parameters<ExportForTranslation>
  ): Promise<GTSerializedDocument> => {
    const [
      docInfo,
      context,
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
    const baseLanguage = gtConfig.getSourceLocale();
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
      languageField,
      mergeWithTargetLocale
    );
  },
  secretsNamespace: 'translationService',
};
