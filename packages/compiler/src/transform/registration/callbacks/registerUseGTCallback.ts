import { TransformState } from '../../../state/types';
import hashSource from '../../../utils/calculateHash';

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
}: {
  identifier: number;
  state: TransformState;
  content: string;
  context?: string;
  id?: string;
  maxChars?: number;
  hash?: string;
}): void {
  // Calculate hash for the call expression
  hash ||= hashSource({
    source: content,
    id,
    context,
    maxChars,
    dataFormat: 'ICU',
  });

  // Add the translation content to the string collector (under identifier mapping to useGT call)
  state.stringCollector.pushTranslationContent(identifier, {
    message: content,
    hash,
    id,
    context,
    maxChars,
  });

  // Increment counter so we can revisit this same invocation on second pass
  const counterId = state.stringCollector.incrementCounter();

  // Register the hash under this counter
  state.stringCollector.setTranslationHash(counterId, {
    hash,
  });
}
