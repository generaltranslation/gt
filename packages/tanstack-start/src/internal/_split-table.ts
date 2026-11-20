import type { SplitContents, SplitTable } from '../split/types';

/**
 * Replaced in the server build by the gt-tanstack-start Vite plugin with what
 * the client build wrote, when the build splits translations.
 */
export const table: SplitTable | undefined = undefined;

export const loadContents:
  | Record<string, () => Promise<{ default: SplitContents }>>
  | undefined = undefined;
