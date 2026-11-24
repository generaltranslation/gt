import { initializeGTForTesting as initializeGT } from '@generaltranslation/react-core/pure';
import type { ReactNode } from 'react';

initializeGT();

// The names below replace the ones this re-exports: local exports come first.
// The package's exports give this entry the main entry's declarations, so
// these take whatever the real ones take and read only what they use.
export * from './index.client';

export { initializeGT };

/** Like `initializeGT()` here: it loads nothing. */
export async function initializeGTSPA(
  config?: Parameters<typeof initializeGT>[0]
): Promise<void> {
  initializeGT(config);
}

/** Renders its children: nothing below it needs a provider here. */
export function GTProvider({ children }: { children?: ReactNode }): ReactNode {
  return children;
}
