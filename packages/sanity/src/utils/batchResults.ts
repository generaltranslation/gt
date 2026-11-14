import type {
  UploadSourceFilesResponse,
  UploadTranslationsResponse,
} from '@generaltranslation/api';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';

// Source upload results carry no locale; translation upload results do.
type BatchItemResult = Pick<
  UploadSourceFilesResponse['results'][number],
  'fileId' | 'status' | 'error'
> &
  Partial<Pick<UploadTranslationsResponse['results'][number], 'locale'>>;

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
  response: { results: BatchItemResult[] }
): string {
  return createDiagnosticMessage({
    source: 'gt-sanity',
    severity: 'Warning',
    whatHappened,
    details: response.results
      .filter((result) => result.status === 'failed')
      .map(
        ({ fileId, locale, error }) =>
          `${fileId}${locale ? ` (${locale})` : ''}: ${error ?? 'no reason given'}`
      ),
  });
}
