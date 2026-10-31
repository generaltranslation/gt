// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import {
  ExportForTranslation,
  GTSerializedDocument,
  ImportTranslation,
} from '../../types';
import { requireLatestDraft } from '../utils/requireSourceDocument';
import { pluginConfig } from '../../adapter/core';
import { importDocument } from '../../translation/importDocument';
import { serializeDocument } from '../../utils/serialize';
import {
  allowsNonDefaultSourceLocales,
  getDocumentLanguage,
  isNonDefaultSourceLanguage,
} from '../../utils/translationSource';

export const baseDocumentLevelConfig = {
  exportForTranslation: async (
    docInfo: Parameters<ExportForTranslation>[0],
    context: Parameters<ExportForTranslation>[1]
  ): Promise<GTSerializedDocument> => {
    const { client, schema } = context;
    const languageField = pluginConfig.getLanguageField();
    const doc = await requireLatestDraft(docInfo.documentId, client);
    // With `allowNonDefaultSourceLocales`, an original outside the configured
    // source locale declares its own language; everything else keeps the
    // configured source locale.
    const documentLanguage = allowsNonDefaultSourceLocales()
      ? getDocumentLanguage(doc)
      : undefined;
    const sourceLocale =
      documentLanguage && isNonDefaultSourceLanguage(documentLanguage)
        ? documentLanguage
        : undefined;
    delete doc[languageField];
    const baseLanguage = sourceLocale ?? pluginConfig.getSourceLocale();
    const serialized = serializeDocument(doc, schema, baseLanguage);
    return {
      content: serialized.content,
      documentId: docInfo.documentId,
      versionId: docInfo.versionId,
      ...(sourceLocale && { sourceLocale }),
    };
  },
  importTranslation: (
    docInfo: Parameters<ImportTranslation>[0],
    localeId: Parameters<ImportTranslation>[1],
    document: Parameters<ImportTranslation>[2],
    context: Parameters<ImportTranslation>[3],
    mergeWithTargetLocale: boolean = false
  ): Promise<void> => {
    return importDocument(
      docInfo,
      localeId,
      document,
      context,
      mergeWithTargetLocale
    );
  },
  secretsNamespace: 'generaltranslation',
};
