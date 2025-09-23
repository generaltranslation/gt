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
} from '../../serialization/';
import { pluginConfig } from '../../adapter/core';
import { PortableTextHtmlComponents } from '@portabletext/to-html';
import merge from 'lodash.merge';

export const baseDocumentLevelConfig = {
  exportForTranslation: async (
    docInfo: Parameters<ExportForTranslation>[0],
    context: Parameters<ExportForTranslation>[1]
  ): Promise<GTSerializedDocument> => {
    const { client, schema } = context;
    const languageField = pluginConfig.getLanguageField();
    const stopTypes = [
      ...defaultStopTypes,
      ...pluginConfig.getAdditionalStopTypes(),
    ];
    const serializers = merge(
      customSerializers,
      pluginConfig.getAdditionalSerializers()
    ) satisfies Partial<PortableTextHtmlComponents>;

    const doc = await findLatestDraft(docInfo.documentId, client);
    delete doc[languageField];
    const baseLanguage = pluginConfig.getSourceLocale();
    const serialized = BaseDocumentSerializer(schema).serializeDocument(
      doc,
      'document',
      baseLanguage,
      stopTypes,
      serializers
    );
    console.log('source doc:', JSON.stringify(doc, null, 2));
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
    mergeWithTargetLocale: boolean = false,
    publish: boolean = false
  ): Promise<void> => {
    const { client } = context;
    const languageField = pluginConfig.getLanguageField();
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

    console.log('deserialized', JSON.stringify(deserialized, null, 2));
    return documentLevelPatch(
      docInfo, // versionId is not used here, since we just use the _rev id in the deserialized HTML itself
      deserialized,
      localeId,
      client,
      languageField,
      mergeWithTargetLocale,
      publish
    );
  },
  secretsNamespace: 'generaltranslation',
};
