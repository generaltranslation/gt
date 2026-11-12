import type { CatalogCheck, ParaglideUsage } from '../analysis/types.js';
import { patternMatcher } from '../paraglide/catalog.js';

/** A dynamic name lists at most this many matching messages. */
const MAX_MATCHES = 50;
/** The warning about messages not in the catalog lists at most this many usages. */
const MAX_LISTED = 10;

/** Whether `catalog`, an outdir's message ids, has the message a usage names. */
export function checkCatalog(
  usage: Pick<ParaglideUsage, 'name' | 'dynamic'>,
  catalog: ReadonlySet<string>
): CatalogCheck {
  if (!usage.dynamic) return { exists: catalog.has(usage.name) };

  const matches = [...catalog].filter(patternMatcher(usage.name)).sort();

  return { exists: matches.length > 0, matches: firstMatches(matches) };
}

/**
 * "12 usage(s) of messages not in the catalog: typo (src/main.ts:3:21), …,
 * and 2 more"; undefined if there are none. `usages` are already described.
 */
export function unknownMessagesWarning(
  usages: readonly string[]
): string | undefined {
  if (usages.length === 0) return undefined;

  const listed = usages.slice(0, MAX_LISTED).join(', ');
  const unlisted = usages.length - MAX_LISTED;
  const more = unlisted > 0 ? `, and ${unlisted} more` : '';

  return `${usages.length} usage(s) of messages not in the catalog: ${listed}${more}`;
}

function firstMatches(matches: string[]): string[] {
  const unlisted = matches.length - MAX_MATCHES;
  if (unlisted <= 0) return matches;

  return [...matches.slice(0, MAX_MATCHES), `… ${unlisted} more`];
}
