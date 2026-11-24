import type { SanityDocument } from 'sanity';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { api, gt, overrideConfig } from '../adapter/core';
import {
  createTranslationStatusKey,
  getDocumentPublishedId,
} from '../utils/documentIds';
import { getCompletedResults } from './checkTranslationStatus';
import { collectExistingTranslations } from './collectExistingTranslations';

import type { Secrets, TranslationFunctionContext } from '../types';

export type CaptureExistingTranslationsInput = {
  documents: SanityDocument[];
  localeIds: string[];
  secrets: Secrets;
  context: TranslationFunctionContext;
  branchId?: string;
};

export type CaptureExistingTranslationsResult = {
  /** Number of (document, locale) translations General Translation confirmed it saved. */
  capturedCount: number;
  /** Number of documents that had at least one translation uploaded. */
  documentCount: number;
  /** Translations in Sanity left alone because General Translation holds no finished translation of that source version for their locale. */
  skippedCount: number;
};

const EMPTY_RESULT: CaptureExistingTranslationsResult = {
  capturedCount: 0,
  documentCount: 0,
  skippedCount: 0,
};

/**
 * Upload the translations Sanity currently holds as the stored translation for
 * the source version General Translation already has, so a later translation of
 * a newer source version reuses them instead of regenerating.
 *
 * Only replaces a finished translation, never creates one: a locale General
 * Translation has not translated from that source version yet is skipped,
 * because the translation in Sanity was made from an older source and storing
 * it would mark the newer source as already translated.
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

  const seedFiles = await api.downloadFileBatch(
    documents.map((document) => ({
      fileId: getDocumentPublishedId(document),
      branchId,
    }))
  );
  const seedByFileId = new Map(
    (seedFiles.files ?? []).map((file) => [file.fileId, file])
  );

  const existing = await collectExistingTranslations(
    documents.filter((document) =>
      seedByFileId.has(getDocumentPublishedId(document))
    ),
    localeIds,
    context
  );

  const candidates = Array.from(existing.entries()).flatMap(
    ([documentId, translations]) => {
      const seed = seedByFileId.get(documentId);
      return seed ? [{ seed, translations }] : [];
    }
  );
  const candidateCount = candidates.reduce(
    (total, { translations }) => total + translations.length,
    0
  );
  if (candidateCount === 0) {
    return EMPTY_RESULT;
  }

  const completed = await getCompletedResults(
    candidates.flatMap(({ seed, translations }) =>
      translations.map(({ locale }) => ({
        branchId: seed.branchId,
        fileId: seed.fileId,
        versionId: seed.versionId,
        locale,
      }))
    ),
    secrets
  );

  const files = candidates.flatMap(({ seed, translations }) => {
    const replaceable = translations.filter(({ locale }) =>
      completed.has(
        createTranslationStatusKey(
          seed.branchId,
          seed.fileId,
          seed.versionId,
          locale
        )
      )
    );
    if (replaceable.length === 0) {
      return [];
    }
    const reference = {
      fileName: seed.fileName ?? `sanity/${seed.fileId}`,
      fileFormat: 'HTML' as const,
      fileId: seed.fileId,
      versionId: seed.versionId,
      branchId: seed.branchId,
    };

    return [
      {
        source: { ...reference, content: seed.data, locale: sourceLocale },
        translations: replaceable.map(({ locale, content }) => ({
          ...reference,
          content,
          locale,
        })),
      },
    ];
  });
  const replaceableCount = files.reduce(
    (total, file) => total + file.translations.length,
    0
  );
  const skippedCount = candidateCount - replaceableCount;

  if (files.length === 0) {
    return { ...EMPTY_RESULT, skippedCount };
  }

  const response = await api.uploadTranslations(files, { sourceLocale });

  return {
    capturedCount: response.uploadedFiles.length,
    documentCount: files.length,
    skippedCount,
  };
}
