import type { ParaglideUsage } from '../analysis/types.js';
import { patternMatcher } from '../paraglide/catalog.js';
import type { Diagnostic } from '../utils/diagnostics.js';

/** The warning about messages not in the catalog lists at most this many usages. */
const MAX_LISTED = 10;

/** Whether `catalog` has the message, or for a dynamic name, any message it matches. */
export function isInCatalog(
  usage: Pick<ParaglideUsage, 'name' | 'dynamic'>,
  catalog: ReadonlySet<string>
): boolean {
  if (!usage.dynamic) return catalog.has(usage.name);

  return [...catalog].some(patternMatcher(usage.name));
}

/**
 * "12 usage(s) of messages not in the catalog get no metadata", with details
 * "typo (src/main.ts:3:21), …, and 2 more"; undefined if there are none.
 * `usages` are already described.
 */
export function unknownMessagesWarning(
  usages: readonly string[]
): Diagnostic | undefined {
  if (usages.length === 0) return undefined;

  const unlisted = usages.length - MAX_LISTED;
  const more = unlisted > 0 ? [`and ${unlisted} more`] : [];

  return {
    whatHappened: `${usages.length} usage(s) of messages not in the catalog get no metadata`,
    details: [...usages.slice(0, MAX_LISTED), ...more],
  };
}
