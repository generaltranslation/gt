import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { LookupOptions } from '../translation-functions/types/options';
import type { Content } from '@generaltranslation/format/types';

/**
 * Hash a message string
 */
export function hashMessage<T extends Content>(
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

  return hashSource({
    source: options.$format === 'ICU' ? indexVars(message as string) : message,
    ...(metadataOptions.$context && { context: metadataOptions.$context }),
    ...(metadataOptions.$maxChars != null && {
      maxChars: Math.abs(metadataOptions.$maxChars),
    }),
    ...(metadataOptions.$requiresReview === true && { requiresReview: true }),
    dataFormat: options.$format,
  });
}
