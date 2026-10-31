import type { MessageTree } from '@generaltranslation/icu';
import { stableStringify } from '../utils/stableStringify';
import { hashString } from './hashSource';
import type { HashMetadata } from './types';

/**
 * Version of the message tree hash input. Bump it whenever the hashed shape
 * changes so old and new catalog keys never collide.
 */
export const MESSAGE_TREE_HASH_VERSION = 1;

export type MessageTreeHashMetadata = Pick<
  HashMetadata,
  'context' | 'maxChars' | 'requiresReview'
>;

/**
 * Calculates a stable hash for a message tree. Object key order does not
 * matter.
 *
 * @param {MessageTree} tree - The message tree.
 * @param {MessageTreeHashMetadata} [metadata] - Metadata that changes the translation.
 * @param {function} [hashFunction] - Custom hash function.
 * @returns {string} - The hash of the tree and its metadata (16 hex chars by default).
 */
export function hashMessageTree(
  tree: MessageTree,
  { context, maxChars, requiresReview }: MessageTreeHashMetadata = {},
  hashFunction: (string: string) => string = hashString
): string {
  return hashFunction(
    stableStringify({
      v: MESSAGE_TREE_HASH_VERSION,
      tree,
      ...(context && { context }),
      ...(maxChars != null && { maxChars: Math.abs(maxChars) }),
      ...(requiresReview === true && { requiresReview: true }),
    })
  );
}
