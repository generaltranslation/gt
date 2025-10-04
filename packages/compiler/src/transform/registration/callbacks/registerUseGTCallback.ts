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

  // This is incorrect here and should be moved to when we want to track useGT() and getGT() invocations
  // // Store the t() function call
  // const counterId = state.stringCollector.incrementCounter();
  // state.stringCollector.initializeAggregator(counterId);

  // // Add the message to the string collector for the gt() function
  // state.stringCollector.setTranslationHash(
  //   counterId,
  //   createTranslationHash(hash)
  // );
}
