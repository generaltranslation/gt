import type { SanityDocument } from 'sanity';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { api, gt, overrideConfig } from '../adapter/core';
import { getDocumentPublishedId } from '../utils/documentIds';
import { collectExistingTranslations } from './collectExistingTranslations';
import {
  failedResultsDiagnostic,
  succeededResults,
} from '../utils/batchResults';

import type { Secrets, TranslationFunctionContext } from '../types';

export type CaptureExistingTranslationsInput = {
  documents: SanityDocument[];
  localeIds: string[];
  secrets: Secrets;
  context: TranslationFunctionContext;
  branchId?: string;
};

export type CaptureExistingTranslationsResult = {
  /** Number of (document, locale) translations uploaded. */
  capturedCount: number;
  /** Number of documents that had at least one translation uploaded. */
  documentCount: number;
  /** Number of (document, locale) translations General Translation did not save. */
  failedCount: number;
};

const EMPTY_RESULT: CaptureExistingTranslationsResult = {
  capturedCount: 0,
  documentCount: 0,
  failedCount: 0,
};

/**
 * Upload the translations Sanity currently holds as the stored translation for
 * the source version General Translation already has, so a later translation of
 * a newer source version reuses them instead of regenerating.
 *
 * Must run before the current source revision is uploaded: the target version is
 * whatever General Translation holds now, which the upload would advance.
 * Documents with no source file there yet are skipped.
 */
export async function captureExistingTranslations({
  documents,
  localeIds,
  secrets,
  context,
  branchId,
}: CaptureExistingTranslationsInput): Promise<CaptureExistingTranslationsResult> {
  if (documents.length === 0 || localeIds.length === 0) {
    return EMPTY_RESULT;
  }

  overrideConfig(secrets);
  const sourceLocale = gt.sourceLocale || libraryDefaultLocale;

  // No versionId: read the latest source version General Translation holds.
  const { results: seedFiles } = await api.queryFilesContent(
    documents.map((document) => ({
      fileId: getDocumentPublishedId(document),
      branchId,
    }))
  );
  const seedByFileId = new Map(
    seedFiles.flatMap((file) =>
      file.status === 'ready' && typeof file.data === 'string'
        ? [[file.fileId, { ...file, data: file.data }] as const]
        : []
    )
  );

  const existing = await collectExistingTranslations(
    documents.filter((document) =>
      seedByFileId.has(getDocumentPublishedId(document))
    ),
    localeIds,
    context
  );

  const files = Array.from(existing.entries()).flatMap(
    ([documentId, translations]) => {
      const seed = seedByFileId.get(documentId);
      if (!seed || translations.length === 0) {
        return [];
      }
      const fileName = seed.fileName ?? `sanity/${documentId}`;
      const reference = {
        fileName,
        fileFormat: 'HTML' as const,
        fileId: seed.fileId,
        versionId: seed.versionId,
        branchId: seed.branchId,
      };

      return [
        {
          source: { ...reference, content: seed.data, locale: sourceLocale },
          translations: translations.map(({ locale, content }) => ({
            ...reference,
            content,
            locale,
          })),
        },
      ];
    }
  );

  if (files.length === 0) {
    return EMPTY_RESULT;
  }

  const uploadResult = await api.uploadTranslations(files);
  if (uploadResult.summary.failed > 0) {
    console.warn(
      failedResultsDiagnostic(
        'Some existing translations could not be preserved',
        uploadResult,
        'Warning'
      )
    );
  }

  const captured = succeededResults(uploadResult);
  return {
    capturedCount: captured.length,
    documentCount: new Set(captured.map(({ fileId }) => fileId)).size,
    failedCount: uploadResult.summary.failed,
  };
}
