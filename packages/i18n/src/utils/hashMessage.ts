import { hashSource } from 'generaltranslation/id';
import { VAR_IDENTIFIER } from 'generaltranslation/internal';
import { LookupOptions } from '../translation-functions/types/options';
import type { Content } from '@generaltranslation/format/types';
import { createGtI18nDiagnostic } from '../logs/diagnostics';

/**
 * Hash a message string
 *
 * An ICU message with `_gt_` variables hashes in its indexed form, which needs
 * the ICU parser. To keep the parser out of /unstable entries this function
 * cannot index; legacy ICU lookups set `$_hash` with {@link withIcuHash}.
 */
export function hashMessage<T extends Content>(
  message: T,
  options: LookupOptions
): string {
  if (options.$_hash != null) {
    return options.$_hash;
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    needsIcuIndexing(message, options)
  ) {
    throw new Error(createUnindexedIcuHashMessage(message as string));
  }
  return hashMessageSource(message, options);
}

/** True when the lookup hash is computed from the indexed ICU message. */
export function needsIcuIndexing(
  message: Content,
  options: LookupOptions
): boolean {
  return (
    options.$format === 'ICU' &&
    typeof message === 'string' &&
    message.includes(VAR_IDENTIFIER)
  );
}

/** Hash an already indexed source with the lookup's metadata. */
export function hashMessageSource(
  source: Content,
  options: LookupOptions
): string {
  const metadataOptions = options as {
    $context?: string;
    $maxChars?: number;
    $requiresReview?: boolean;
  };
  return hashSource({
    source,
    ...(metadataOptions.$context && { context: metadataOptions.$context }),
    ...(metadataOptions.$maxChars != null && {
      maxChars: Math.abs(metadataOptions.$maxChars),
    }),
    ...(metadataOptions.$requiresReview === true && { requiresReview: true }),
    dataFormat: options.$format,
  });
}

function createUnindexedIcuHashMessage(message: string): string {
  return createGtI18nDiagnostic({
    severity: 'Error',
    whatHappened: `An ICU message with ${VAR_IDENTIFIER} variables was hashed without a precomputed $_hash`,
    why: 'its lookup hash comes from the indexed message, and hashMessage does not load the ICU parser',
    fix: 'Pass the lookup options through withIcuHash from gt-i18n/internal before the lookup',
    details: `Message: "${message}"`,
  });
}
