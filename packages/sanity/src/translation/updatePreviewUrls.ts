import type { SanityClient } from 'sanity';
import { pluginConfig, projectFor } from '../adapter/core';
import type { Secrets } from '../types';
import { resolvePreviewUrls } from './previewUrls';

export type ImportedTranslation = {
  /** The document the translation was written to, by published id and type. */
  written: { id: string; type: string };
  /** The GT file the translation belongs to. */
  file: { branchId?: string; fileId: string; versionId: string };
  /** The Sanity language id the translation was imported as. */
  language: string;
};

/**
 * Stores each imported translation's page as its preview URL in GT. Pages are
 * read from the written drafts, since an imported translation is usually not
 * published yet. Returns why any could not be stored; the imports stay as they
 * are.
 */
export async function updateTranslationPreviewUrls(
  imported: ImportedTranslation[],
  client: SanityClient,
  secrets: Secrets | null
): Promise<unknown[]> {
  if (!pluginConfig.getPreviewUrl() || imported.length === 0) return [];
  const { urls, failures } = await resolvePreviewUrls(
    imported.map(({ written, language }) => ({ ...written, language })),
    client,
    'drafts'
  );
  const files = imported.flatMap(({ file, language }, index) => {
    const previewUrl = urls[index];
    return previewUrl
      ? [{ ...file, locale: language, metadata: { previewUrl } }]
      : [];
  });
  if (files.length === 0) return failures;
  try {
    await projectFor(secrets).updateFiles(files);
  } catch (error) {
    failures.push(error);
  }
  return failures;
}
