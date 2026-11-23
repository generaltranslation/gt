import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { LookupOptions } from '../translation-functions/types/options';
import { Translation } from '../types';
import type { IcuMessage } from '@generaltranslation/format/types';

const HASH_CACHE_LIMIT = 5000;
const hashCache = new Map<string, string>();

/**
 * Hash a message string
 */
export function hashMessage<T extends Translation>(
  message: T,
  options: LookupOptions
): string {
  const metadataOptions = options as {
    $_hash?: string;
    $context?: string;
    $id?: string;
    $maxChars?: number;
    $requiresReview?: boolean;
  };
  if (metadataOptions.$_hash != null) {
    return metadataOptions.$_hash;
  }

  const maxChars =
    metadataOptions.$maxChars != null
      ? Math.abs(metadataOptions.$maxChars)
      : undefined;
  const requiresReview = metadataOptions.$requiresReview === true;
  // Exactly the inputs hashSource reads below; $id is not one of them.
  const cacheKey =
    typeof message === 'string'
      ? JSON.stringify([
          options.$format,
          metadataOptions.$context || '',
          maxChars ?? null,
          requiresReview,
          message,
        ])
      : undefined;
  if (cacheKey !== undefined) {
    const cached = hashCache.get(cacheKey);
    if (cached !== undefined) return cached;
  }

  const hash = hashSource({
    source:
      options.$format === 'ICU' ? indexVars(message as IcuMessage) : message,
    ...(metadataOptions.$context && { context: metadataOptions.$context }),
    ...(maxChars != null && { maxChars }),
    ...(requiresReview && { requiresReview: true }),
    dataFormat: options.$format,
  });

  if (cacheKey !== undefined) {
    if (hashCache.size >= HASH_CACHE_LIMIT) {
      const oldestKey = hashCache.keys().next().value;
      if (oldestKey !== undefined) hashCache.delete(oldestKey);
    }
    hashCache.set(cacheKey, hash);
  }
  return hash;
}
