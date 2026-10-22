import type { GTFile, Secrets } from '../types';
import { api, gt, overrideConfig } from '../adapter/core';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { SerializedDocument } from '../serialization/types';
import { resolveFileName } from '../utils/fileNames';
import {
  failedResultsDiagnostic,
  uploadIdError,
  withRejectedResults,
} from '../utils/batchResults';
import { syncProjectDefaultLocale } from '../adapter/syncProjectDefaultLocale';

export async function uploadFiles(
  documents: {
    info: GTFile;
    serializedDocument: SerializedDocument;
  }[],
  secrets: Secrets | null
): Promise<Awaited<ReturnType<typeof api.uploadSourceFiles>>> {
  overrideConfig(secrets);
  // A document GT cannot store would fail the whole request, so it fails alone.
  const rejected = documents.filter(({ info }) => uploadIdError(info));
  const accepted = documents.filter(({ info }) => !uploadIdError(info));
  const sent = await api.uploadSourceFiles(
    accepted.map(({ info, serializedDocument }) => ({
      source: {
        content: serializedDocument.content,
        fileName: resolveFileName(info),
        fileId: info.documentId,
        fileFormat: 'HTML',
        locale: gt.sourceLocale || libraryDefaultLocale,
        versionId: info.versionId || undefined,
      },
    })),
    {
      sourceLocale: gt.sourceLocale || libraryDefaultLocale,
    }
  );
  const uploadResult = withRejectedResults(
    sent,
    rejected.map(({ info }) => ({
      branchId: '',
      fileId: info.documentId,
      versionId: info.versionId ?? '',
      fileName: resolveFileName(info),
      fileFormat: 'HTML' as const,
      status: 'failed' as const,
      error: uploadIdError(info),
    }))
  );
  if (uploadResult.summary.failed > 0) {
    console.warn(
      failedResultsDiagnostic(
        'Some documents could not be uploaded to General Translation and were skipped',
        uploadResult,
        'Warning'
      )
    );
  }
  if (uploadResult.summary.succeeded > 0) {
    await syncProjectDefaultLocale(gt.sourceLocale || libraryDefaultLocale);
  }
  return uploadResult;
}
