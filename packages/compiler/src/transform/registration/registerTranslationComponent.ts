import { TransformState } from '../../state/types';

/**
 * Track gt() function invocations
 * - Adds the translation content to the string collector
 */
export function registerTranslationComponent(
  state: TransformState,
  hash: string,
  options?: {
    children?: unknown;
    id?: string;
    context?: string;
  }
): void {
  // Increment counter
  const identifier = state.stringCollector.incrementCounter();
  // Add the translation content to the string collector
  state.stringCollector.setTranslationJsx(identifier, {
    hash,
    children: options?.children,
    id: options?.id,
    context: options?.context,
  });
}
