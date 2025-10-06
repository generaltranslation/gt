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
  id?: string
): void {
  // Calculate hash for the call expression
  const hash = hashSource({ source: content, id, context, dataFormat: 'ICU' });

  // Add the translation content to the string collector
  state.stringCollector.setTranslationContent(identifier, {
    message: content,
    hash,
    id,
    context,
  });
}
