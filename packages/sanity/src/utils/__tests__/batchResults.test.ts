import { describe, expect, it } from 'vitest';
import {
  existingTranslationsUploadToasts,
  filterUploadedDocuments,
} from '../batchResults';

describe('filterUploadedDocuments', () => {
  it('keeps only the documents whose source upload succeeded', () => {
    const documents = ['saved', 'failed'].map((documentId) => ({
      info: { documentId, versionId: `${documentId}-rev` },
      translations: [{ locale: 'fr', content: `<p>${documentId}</p>` }],
    }));

    const result = filterUploadedDocuments(documents, {
      results: [
        { fileId: 'saved', status: 'succeeded' },
        { fileId: 'failed', status: 'failed', error: 'not saved' },
      ],
    });

    expect(result).toEqual([documents[0]]);
  });
});

describe('existingTranslationsUploadToasts', () => {
  const summary = (succeeded: number, failed: number) => ({
    summary: { total: succeeded + failed, succeeded, failed },
  });

  it('reports partial source failures alongside the uploaded translations', () => {
    expect(
      existingTranslationsUploadToasts(summary(1, 1), summary(2, 0), 1)
    ).toEqual([
      {
        title: 'Uploaded 2 existing translation(s) across 1 document(s)',
        status: 'success',
      },
      {
        title:
          '1 document(s) could not be uploaded, so their existing translations were skipped. Check the console for details.',
        status: 'warning',
      },
    ]);
  });

  it('reports a total source failure instead of finding no translations', () => {
    expect(existingTranslationsUploadToasts(summary(0, 2), null, 0)).toEqual([
      {
        title:
          '2 document(s) could not be uploaded, so their existing translations were skipped. Check the console for details.',
        status: 'warning',
      },
    ]);
  });

  it('reports no existing translations when every source uploaded', () => {
    expect(existingTranslationsUploadToasts(summary(2, 0), null, 0)).toEqual([
      { title: 'No existing translations found to upload', status: 'warning' },
    ]);
  });
});
