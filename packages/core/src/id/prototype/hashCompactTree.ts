// PROTOTYPE: hashMessageTree for the compact tree shape in
// packages/icu/src/prototype. Compact trees carry no locations, so nothing is
// stripped before hashing.
import { stableStringify } from '../../utils/stableStringify';
import { hashString } from '../hashSource';
import type { MessageTreeHashMetadata } from '../hashMessageTree';

/** A new version, so compact keys never collide with version 1 AST keys. */
export const COMPACT_TREE_HASH_VERSION = 2;

export function hashCompactTree(
  tree: unknown[],
  { context, maxChars, requiresReview }: MessageTreeHashMetadata = {},
  hashFunction: (string: string) => string = hashString
): string {
  return hashFunction(
    stableStringify({
      v: COMPACT_TREE_HASH_VERSION,
      tree,
      ...(context && { context }),
      ...(maxChars != null && { maxChars: Math.abs(maxChars) }),
      ...(requiresReview === true && { requiresReview: true }),
    })
  );
}
