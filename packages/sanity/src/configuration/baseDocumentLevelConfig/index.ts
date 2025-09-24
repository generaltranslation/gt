// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import {
  ExportForTranslation,
  GTSerializedDocument,
  ImportTranslation,
} from '../../types';
import { findLatestDraft } from '../utils/findLatestDraft';
import { pluginConfig } from '../../adapter/core';
import { importDocument } from '../../translation/importDocument';
import { serializeDocument } from '../../utils/serialize';

export const baseDocumentLevelConfig = {
  exportForTranslation: async (
    docInfo: Parameters<ExportForTranslation>[0],
    context: Parameters<ExportForTranslation>[1]
  ): Promise<GTSerializedDocument> => {
    const { client, schema } = context;
    const languageField = pluginConfig.getLanguageField();
    const doc = await findLatestDraft(docInfo.documentId, client);
    delete doc[languageField];
    const baseLanguage = pluginConfig.getSourceLocale();
    const serialized = serializeDocument(doc, schema, baseLanguage);
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
    return importDocument(
      docInfo,
      localeId,
      document,
      context,
      mergeWithTargetLocale,
      publish
    );
  },
  secretsNamespace: 'generaltranslation',
};
