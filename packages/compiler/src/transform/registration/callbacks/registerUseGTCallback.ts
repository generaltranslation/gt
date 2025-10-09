import { TransformState } from '../../../state/types';
import { hashSource } from 'generaltranslation/id';

/**
 * Track gt() function invocations
 * - Adds the translation content to the string collector
 */
export function registerUseGTCallback(
  identifier: number,
  state: TransformState,
  content: string,
  context?: string,
  id?: string,
  hash?: string
): void {
  // Calculate hash for the call expression
  hash ||= hashSource({ source: content, id, context, dataFormat: 'ICU' });

  // Add the translation content to the string collector (under identifier mapping to useGT call)
  state.stringCollector.pushTranslationContent(identifier, {
    message: content,
    hash,
    id,
    context,
  });

  // Increment counter so we can revisit this same invocation on second pass
  const counterId = state.stringCollector.incrementCounter();

  // Register the hash under this counter
  state.stringCollector.setTranslationHash(counterId, {
    hash,
  });
}
