import { TransformState } from '../../state/types';

/**
 * Track gt() function invocations
 * - Adds the translation content to the string collector
 */
export function registerTranslationComponent(
  state: TransformState,
  hash: string
): void {
  // Increment counter
  const identifier = state.stringCollector.incrementCounter();

  console.log(`[GT_PLUGIN] register <T> hash`, hash, 'identifier', identifier);

  // Add the translation content to the string collector
  state.stringCollector.setTranslationJsx(identifier, {
    hash,
  });
}
