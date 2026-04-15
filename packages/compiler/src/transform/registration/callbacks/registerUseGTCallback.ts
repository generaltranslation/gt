import { TransformState } from '../../../state/types';
import hashSource from '../../../utils/calculateHash';
import type { DataFormat } from 'generaltranslation/types';

/**
 * Track gt() function invocations
 * - Adds the translation content to the string collector
 */
export function registerUseGTCallback({
  identifier,
  state,
  content,
  context,
  id,
  maxChars,
  hash,
  format,
}: {
  identifier: number;
  state: TransformState;
  content: string;
  context?: string;
  id?: string;
  maxChars?: number;
  hash?: string;
  format?: string;
}): void {
  // Calculate hash for the call expression (skip if already set, including empty string for derive context)
  hash ??= hashSource({
    source: content,
    id,
    context,
    maxChars,
    dataFormat: (format || 'ICU') as DataFormat,
  });

  // Add the translation content to the string collector (under identifier mapping to useGT call)
  state.stringCollector.pushTranslationContent(identifier, {
    message: content,
    hash,
    id,
    context,
    maxChars,
    format,
  });

  // Increment counter so we can revisit this same invocation on second pass
  const counterId = state.stringCollector.incrementCounter();

  // Register the hash under this counter
  state.stringCollector.setTranslationHash(counterId, {
    hash,
  });
}
