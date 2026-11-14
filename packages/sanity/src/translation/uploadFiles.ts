import type { GTFile, Secrets } from '../types';
import type { UploadSourceFilesResponse } from '@generaltranslation/api';
import { gt, projectFor } from '../adapter/core';
import type { SerializedDocument } from '../serialization/types';
import { resolveFileName } from '../utils/fileNames';
import { allowsNonDefaultSourceLocales } from '../utils/translationSource';
import { failedResultsDiagnostic } from '../utils/batchResults';
import { syncProjectDefaultLocale } from '../adapter/syncProjectDefaultLocale';

export async function uploadFiles(
  documents: {
    info: GTFile;
    serializedDocument: SerializedDocument;
  }[],
  secrets: Secrets | null
): Promise<UploadSourceFilesResponse> {
  const project = projectFor(secrets);
  // With `allowNonDefaultSourceLocales`, each file declares the language of
  // its own document, so one request can mix originals in different locales.
  const allowNonDefault = allowsNonDefaultSourceLocales();
  const uploadResult = await project.uploadSourceFiles(
    documents.map(({ info, serializedDocument }) => ({
      source: {
        content: serializedDocument.content,
        fileName: resolveFileName(info),
        fileId: info.documentId,
        fileFormat: 'HTML',
        locale:
          (allowNonDefault ? info.sourceLocale : undefined) ?? gt.defaultLocale,
        versionId: info.versionId || undefined,
        metadata: info.previewUrl ? { previewUrl: info.previewUrl } : undefined,
      },
    })),
    {
      sourceLocale: gt.defaultLocale,
    }
  );
  if (uploadResult.summary.failed > 0) {
    console.warn(
      failedResultsDiagnostic(
        'Some documents could not be uploaded to General Translation and were skipped',
        uploadResult
      )
    );
  }
  if (uploadResult.summary.succeeded > 0) {
    await syncProjectDefaultLocale(project, gt.defaultLocale);
  }
  return uploadResult;
}
