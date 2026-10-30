import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { LookupOptions } from '../translation-functions/types/options';
import type { Translation } from '../i18n-cache/translations-manager/utils/types/translation-data';
import type { IcuMessage } from '@generaltranslation/format';

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
    context: metadataOptions.$context,
    maxChars: metadataOptions.$maxChars,
    requiresReview: metadataOptions.$requiresReview,
    dataFormat: options.$format,
  });
}
