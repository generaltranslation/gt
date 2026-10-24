import type { GTFile, Secrets } from '../types';
import type { ProjectHandle } from 'generaltranslation';
import { gt, projectFor } from '../adapter/core';
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
): Promise<Awaited<ReturnType<ProjectHandle['uploadSourceFiles']>>> {
  const project = projectFor(secrets);
  // A document GT cannot store would fail the whole request, so it fails alone.
  const rejected = documents.filter(({ info }) => uploadIdError(info));
  const accepted = documents.filter(({ info }) => !uploadIdError(info));
  const sent = await project.uploadSourceFiles(
    accepted.map(({ info, serializedDocument }) => ({
      source: {
        content: serializedDocument.content,
        fileName: resolveFileName(info),
        fileId: info.documentId,
        fileFormat: 'HTML',
        locale: gt.defaultLocale,
        versionId: info.versionId || undefined,
      },
    })),
    {
      sourceLocale: gt.defaultLocale,
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
    await syncProjectDefaultLocale(project, gt.defaultLocale);
  }
  return uploadResult;
}
