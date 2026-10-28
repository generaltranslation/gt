import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { LookupOptions } from '../translation-functions/types/options';
import type { Content, IcuMessage } from '@generaltranslation/format';

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
    source:
      options.$format === 'ICU' ? indexVars(message as IcuMessage) : message,
    context: metadataOptions.$context,
    maxChars: metadataOptions.$maxChars,
    requiresReview: metadataOptions.$requiresReview,
    dataFormat: options.$format,
  });
}
