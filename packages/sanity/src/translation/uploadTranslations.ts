import type { GTFile, Secrets } from '../types';
import { api, gt, overrideConfig } from '../adapter/core';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { SerializedDocument } from '../serialization/types';
import type { ExistingTranslation } from './collectExistingTranslations';

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
  return await api.uploadTranslations(
    withTranslations.map(({ info, serializedDocument, translations }) => ({
      source: {
        content: serializedDocument.content,
        fileName: `sanity/${info.documentId}`,
        fileId: info.documentId,
        fileFormat: 'HTML' as const,
        locale: sourceLocale,
        versionId: info.versionId || undefined,
      },
      translations: translations.map(({ locale, content }) => ({
        content,
        fileName: `sanity/${info.documentId}`,
        fileId: info.documentId,
        fileFormat: 'HTML' as const,
        locale,
        versionId: info.versionId || undefined,
      })),
    })),
    { sourceLocale }
  );
}
