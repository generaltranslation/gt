import type { SanityDocument } from 'sanity';
import type { GTFile } from '../types';
import { getDocumentPublishedId } from './documentIds';

/**
 * The display name a document is uploaded under: `sanity/<type>/<title>`.
 * General Translation identifies files by `fileId` and `versionId`, so the
 * name is cosmetic and a re-upload under a new name renames the file.
 */
export function getDocumentFileName(document: SanityDocument): string {
  const slug = (document.slug as { current?: unknown } | undefined)?.current;
  const title = [document.title, document.name, slug].find(
    (value) => typeof value === 'string' && value.trim() !== ''
  ) as string | undefined;
  const label = title?.trim() ?? getDocumentPublishedId(document);
  return `sanity/${document._type}/${label}`;
}

export function resolveFileName(info: GTFile): string {
  return info.fileName ?? `sanity/${info.documentId}`;
}
