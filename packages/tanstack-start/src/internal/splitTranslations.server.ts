// The server's side of split translations. The server renders from the
// locale's whole catalog, as without the split. It only chooses what a page
// gets to hydrate with: the translations of the client chunks of the matched
// routes, which it finds through the router's manifest.
import {
  createChunkTranslationsSeed,
  createChunkTranslationsShellSeed,
} from 'gt-react/chunk-translations/server';
import type { SplitTranslationsOutput } from 'generaltranslation/internal';
import { table } from 'gt-tanstack-start/internal/_split-table';
import type * as Disabled from './splitTranslations';

/**
 * The client chunks a router's manifest names for the matched routes, by
 * their path from the build's base, and the URL they are served from when the
 * manifest says: the build's base, or what the app rewrote it to (TanStack
 * Start's `transformAssets`, as for a CDN). A chunk is recognized by the end
 * of its URL. Every chunk whose import needs translations when the router
 * does not say, so the page then gets all of them.
 */
export function findPageChunks(
  router: Disabled.SplitRouter,
  output: SplitTranslationsOutput
): { chunks: string[]; base: string | undefined } {
  const matches = router.state?.matches;
  const routes = router.ssr?.manifest?.routes;
  if (!matches || !routes) {
    return { chunks: Object.keys(output.imports), base: undefined };
  }
  const isKnown = (chunk: string) =>
    chunk in output.entries || chunk in output.imports;
  const chunks = new Set<string>();
  let base: string | undefined;
  for (const { routeId } of matches) {
    for (const link of routes[routeId]?.preloads ?? []) {
      const [href] = (typeof link === 'string' ? link : link.href).split(
        /[?#]/
      );
      const segments = href.split('/');
      for (let start = 0; start < segments.length; start++) {
        const chunk = segments.slice(start).join('/');
        if (!isKnown(chunk)) continue;
        chunks.add(chunk);
        base ??= href.slice(0, href.length - chunk.length);
        break;
      }
    }
  }
  return { chunks: [...chunks], base };
}

export const createSplitSeed: typeof Disabled.createSplitSeed = (
  router,
  locale,
  translations
) =>
  table && translations
    ? createChunkTranslationsSeed(table, {
        ...findPageChunks(router, table),
        locale,
        translations,
      })
    : undefined;

export const createSplitShellSeed: typeof Disabled.createSplitShellSeed = (
  router
) =>
  table &&
  createChunkTranslationsShellSeed(table, findPageChunks(router, table));

export const seedSplit: typeof Disabled.seedSplit = async () => undefined;

export const loadSplitTranslations: typeof Disabled.loadSplitTranslations =
  undefined;
