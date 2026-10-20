import type { GTFile, Secrets } from '../types';
import { api, gt, overrideConfig } from '../adapter/core';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { SerializedDocument } from '../serialization/types';
import type { ExistingTranslation } from './collectExistingTranslations';
import { resolveFileName } from '../utils/fileNames';
import {
  failedResultsDiagnostic,
  uploadIdError,
  withRejectedResults,
} from '../utils/batchResults';

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
): Promise<Awaited<ReturnType<typeof api.uploadTranslations>> | null> {
  const withTranslations = documents.filter(
    (document) => document.translations.length > 0
  );
  if (withTranslations.length === 0) {
    return null;
  }

  overrideConfig(secrets);
  const sourceLocale = gt.sourceLocale || libraryDefaultLocale;
  // A document GT cannot store would fail the whole request, so it fails alone.
  const rejected = withTranslations.filter(({ info }) => uploadIdError(info));
  const accepted = withTranslations.filter(({ info }) => !uploadIdError(info));
  const sent = await api.uploadTranslations(
    accepted.map(({ info, serializedDocument, translations }) => ({
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
        fileId: info.documentId,
        fileFormat: 'HTML' as const,
        locale,
        versionId: info.versionId || undefined,
      })),
    }))
  );
  const uploadResult = withRejectedResults(
    sent,
    rejected.flatMap(({ info, translations }) =>
      translations.map(({ locale }) => ({
        branchId: '',
        fileId: info.documentId,
        versionId: info.versionId ?? '',
        fileName: resolveFileName(info),
        fileFormat: 'HTML' as const,
        locale,
        status: 'failed' as const,
        error: uploadIdError(info),
      }))
    )
  );
  if (uploadResult.summary.failed > 0) {
    console.warn(
      failedResultsDiagnostic(
        'Some existing translations could not be uploaded to General Translation',
        uploadResult,
        'Warning'
      )
    );
  }
  return uploadResult;
}
