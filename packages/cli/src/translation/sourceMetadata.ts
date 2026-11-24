import type { DataFormat } from '@generaltranslation/format';
import type { Updates } from 'generaltranslation';

export type SourceEntryMetadata = {
  dataFormat: DataFormat;
  id?: string;
  context?: string;
  maxChars?: number;
  requiresReview?: boolean;
  filePaths?: string[];
};

/** Returns each hashed entry's translator-facing metadata, keyed by the same hash as the source file. */
export function collectSourceMetadata(
  updates: Updates
): Record<string, SourceEntryMetadata> {
  const result: Record<string, SourceEntryMetadata> = {};
  for (const { dataFormat, metadata } of updates) {
    const { hash, id, context, maxChars, requiresReview, filePaths } = metadata;
    if (!hash) continue;
    result[hash] = {
      dataFormat,
      ...(id && { id }),
      ...(context && { context }),
      ...(maxChars != null && { maxChars }),
      ...(requiresReview === true && { requiresReview }),
      ...(Array.isArray(filePaths) &&
        filePaths.length > 0 && { filePaths: [...filePaths].sort() }),
    };
  }
  return result;
}
