import { isMessageTree } from '@generaltranslation/icu';
import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import { LookupOptions } from '../translation-functions/types/options';
import { Translation } from '../types';
import type { Content, IcuMessage } from '@generaltranslation/format/types';

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

  assertContent(message);

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

const MESSAGE_TREE_SOURCE_ERROR = createGtI18nDiagnostic({
  severity: 'Error',
  whatHappened: 'A message tree was used as a string or JSX source',
  fix: 'Render message trees with gt-i18n/unstable',
});

/**
 * Legacy sources are string or JSX content, never message trees. An empty
 * array is both empty content and an empty tree, so it stays content.
 */
export function assertContent(
  message: Translation
): asserts message is Content {
  if (Array.isArray(message) && message.length > 0 && isMessageTree(message)) {
    throw new Error(MESSAGE_TREE_SOURCE_ERROR);
  }
}
