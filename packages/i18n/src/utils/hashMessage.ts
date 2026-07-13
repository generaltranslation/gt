import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { LookupOptions } from '../translation-functions/types/options';
import { Translation } from '../types';
import type { IcuMessage } from '@generaltranslation/format/types';

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

  return hashSource({
    source:
      options.$format === 'ICU' ? indexVars(message as IcuMessage) : message,
    ...(metadataOptions.$context && { context: metadataOptions.$context }),
    ...(metadataOptions.$maxChars != null && {
      maxChars: Math.abs(metadataOptions.$maxChars),
    }),
    ...(metadataOptions.$requiresReview === true && { requiresReview: true }),
    dataFormat: options.$format,
  });
}
