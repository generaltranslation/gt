import type { GTFile, Secrets } from '../types';
import type { UploadTranslationsResponse } from '@generaltranslation/api';
import { gt, projectFor } from '../adapter/core';
import type { SerializedDocument } from '../serialization/types';
import type { ExistingTranslation } from './collectExistingTranslations';
import { resolveFileName } from '../utils/fileNames';
import { failedResultsDiagnostic } from '../utils/batchResults';

/**
 * Upload translations that already exist in Sanity for previously serialized
 * source documents. The endpoint is an upsert, so the Sanity content becomes
 * the stored translation for the source's fileId/versionId — this is how
 * human edits are preserved before (re-)enqueueing machine translation.
 *
 * Mirrors the CLI's upload workflow: each translation reuses the source
 * document's fileId and versionId and differs only by locale.
 */
export async function uploadTranslations(
  documents: {
    info: GTFile;
    serializedDocument: SerializedDocument;
    translations: ExistingTranslation[];
  }[],
  secrets: Secrets | null
): Promise<UploadTranslationsResponse | null> {
  const withTranslations = documents.filter(
    (document) => document.translations.length > 0
  );
  if (withTranslations.length === 0) {
    return null;
  }

  const project = projectFor(secrets);
  const sourceLocale = gt.defaultLocale;
  const uploadResult = await project.uploadTranslations(
    withTranslations.map(({ info, serializedDocument, translations }) => ({
      source: {
        content: serializedDocument.content,
        fileName: resolveFileName(info),
        fileId: info.documentId,
        fileFormat: 'HTML' as const,
        locale: sourceLocale,
        versionId: info.versionId || undefined,
      },
      translations: translations.map(({ locale, content }) => ({
        content,
        fileName: resolveFileName(info),
        fileFormat: 'HTML' as const,
        locale,
      })),
    }))
  );
  if (uploadResult.summary.failed > 0) {
    console.warn(
      failedResultsDiagnostic(
        'Some existing translations could not be uploaded to General Translation',
        uploadResult
      )
    );
  }
  return uploadResult;
}
