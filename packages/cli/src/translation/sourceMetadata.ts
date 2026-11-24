import type { Updates } from 'generaltranslation';
import type { MetadataLeaf } from '../formats/parseKeyedMetadata.js';

type Update = Updates[number];

export type SourceEntryMetadata = MetadataLeaf &
  Pick<Update, 'dataFormat'> &
  Pick<Update['metadata'], 'id' | 'requiresReview' | 'filePaths'>;

/** Returns each hashed entry's translator-facing metadata, keyed by the same hash as the source file. */
export function collectSourceMetadata(
  updates: Updates
): Record<string, SourceEntryMetadata> {
  const result: Record<string, SourceEntryMetadata> = {};
  for (const { dataFormat, metadata } of updates) {
    const { hash, id, context, maxChars, requiresReview, filePaths } = metadata;
    const sourceCode = metadata.sourceCode as MetadataLeaf['sourceCode'];
    if (!hash) continue;
    const existing = result[hash];
    if (existing) {
      existing.filePaths = mergePaths(existing.filePaths, filePaths);
      continue;
    }
    const paths = mergePaths(undefined, filePaths);
    result[hash] = {
      dataFormat,
      ...(id && { id }),
      ...(context && { context }),
      ...(maxChars != null && { maxChars }),
      ...(requiresReview !== undefined && { requiresReview }),
      ...(paths && { filePaths: paths }),
      ...(sourceCode && { sourceCode }),
    };
  }
  return result;
}

function mergePaths(
  current: string[] | undefined,
  next: unknown
): string[] | undefined {
  const merged = new Set(current);
  if (Array.isArray(next)) for (const p of next) merged.add(p);
  return merged.size > 0 ? [...merged].sort() : undefined;
}
