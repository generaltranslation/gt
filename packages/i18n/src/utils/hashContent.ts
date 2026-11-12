import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { LookupOptions } from '../translation-functions/types/options';
import type { Content } from '@generaltranslation/format';

/** The hash of content in any data format: its catalog key. */
export function hashContent<T extends Content>(
  content: T,
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
    source: options.$format === 'ICU' ? indexVars(content as string) : content,
    context: metadataOptions.$context,
    maxChars: metadataOptions.$maxChars,
    requiresReview: metadataOptions.$requiresReview,
    dataFormat: options.$format,
  });
}
