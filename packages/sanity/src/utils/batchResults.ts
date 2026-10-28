import type {
  UploadSourceFilesResponse,
  UploadTranslationsResponse,
} from '@generaltranslation/api';
import {
  createDiagnosticMessage,
  type DiagnosticSeverity,
} from 'generaltranslation/diagnostics';

// Source upload results carry no locale; translation upload results do.
type BatchItemResult = Pick<
  UploadSourceFilesResponse['results'][number],
  'fileId' | 'status' | 'error'
> &
  Partial<Pick<UploadTranslationsResponse['results'][number], 'locale'>>;

// GT rejects a whole upload request that holds a longer ID.
const MAX_FILE_ID_LENGTH = 64;
const MAX_VERSION_ID_LENGTH = 255;

export function uploadIdError(info: {
  documentId: string;
  versionId?: string;
}): string | undefined {
  if (info.documentId.length > MAX_FILE_ID_LENGTH)
    return `The document ID is longer than ${MAX_FILE_ID_LENGTH} characters, which General Translation cannot store`;
  if ((info.versionId?.length ?? 0) > MAX_VERSION_ID_LENGTH)
    return `The document revision is longer than ${MAX_VERSION_ID_LENGTH} characters, which General Translation cannot store`;
}

export function withRejectedResults<
  Response extends {
    summary: { total: number; succeeded: number; failed: number };
    results: BatchItemResult[];
  },
>(response: Response, rejected: Response['results']): Response {
  if (!rejected.length) return response;
  return {
    ...response,
    summary: {
      total: response.summary.total + rejected.length,
      succeeded: response.summary.succeeded,
      failed: response.summary.failed + rejected.length,
    },
    results: [...response.results, ...rejected],
  };
}

/** A successful batch request can still contain per-item failures. */
export function succeededResults<Result extends BatchItemResult>(response: {
  results: Result[];
}): Result[] {
  return response.results.filter((result) => result.status === 'succeeded');
}

/** A missing source fails the whole translation upload. */
export function filterUploadedDocuments<
  Document extends { info: { documentId: string } },
>(
  documents: Document[],
  uploadResult: { results: BatchItemResult[] }
): Document[] {
  const uploadedFileIds = new Set(
    succeededResults(uploadResult).map(({ fileId }) => fileId)
  );
  return documents.filter(({ info }) => uploadedFileIds.has(info.documentId));
}

/** Studio toasts for uploading existing translations after seeding their sources. */
export function existingTranslationsUploadToasts(
  sourceUpload: { summary: { failed: number } },
  translationUpload: { summary: { succeeded: number; failed: number } } | null,
  documentCount: number
): Array<{ title: string; status: 'success' | 'warning' }> {
  const succeeded = translationUpload?.summary.succeeded ?? 0;
  const failed = translationUpload?.summary.failed ?? 0;
  const sourceFailed = sourceUpload.summary.failed;
  const toasts: Array<{ title: string; status: 'success' | 'warning' }> = [];
  if (succeeded > 0) {
    toasts.push({
      title: `Uploaded ${succeeded} existing translation(s) across ${documentCount} document(s)`,
      status: 'success',
    });
  } else if (failed === 0 && sourceFailed === 0) {
    toasts.push({
      title: 'No existing translations found to upload',
      status: 'warning',
    });
  }
  if (sourceFailed > 0) {
    toasts.push({
      title: `${sourceFailed} document(s) could not be uploaded, so their existing translations were skipped. Check the console for details.`,
      status: 'warning',
    });
  }
  if (failed > 0) {
    toasts.push({
      title: `${failed} existing translation(s) could not be uploaded. Check the console for details.`,
      status: 'warning',
    });
  }
  return toasts;
}

export function failedResultsDiagnostic(
  whatHappened: string,
  response: { results: BatchItemResult[] },
  severity: DiagnosticSeverity
): string {
  return createDiagnosticMessage({
    source: 'gt-sanity',
    severity,
    whatHappened,
    details: response.results
      .filter((result) => result.status === 'failed')
      .map(
        ({ fileId, locale, error }) =>
          `${fileId}${locale ? ` (${locale})` : ''}: ${error ?? 'no reason given'}`
      ),
  });
}
