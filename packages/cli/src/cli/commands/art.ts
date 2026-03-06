import { runInteractiveAnimation } from '../../console/animation.js';

/**
 * Handler for the `gt art` command.
 */
export async function handleArt(): Promise<void> {
  await runInteractiveAnimation();
}
