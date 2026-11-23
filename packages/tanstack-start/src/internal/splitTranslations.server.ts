// The server's side of split translations. The server renders from the
// locale's whole catalog, as without the split. It only chooses what a page
// gets to hydrate with: the translations of the client chunks of the matched
// routes, which it finds through the router's manifest.
import {
  createChunkTranslationsSeed,
  createChunkTranslationsShellSeed,
} from 'gt-react/chunk-translations/server';
import { getTranslationsSnapshot } from '@generaltranslation/react-core/pure';
import type { SplitTranslationsOutput } from 'generaltranslation/internal';
import { serverMessages, table } from 'gt-tanstack-start/internal/_split-table';
import { findClientReferenceChunks } from '../rsc/clientReferenceChunks';
import type * as Disabled from './splitTranslations';

/**
 * The client chunks a response loads, by their path from the build's base:
 * those the router's manifest names for the matched routes, and those of the
 * client components that a server component in their loader data renders.
 * With them, the URL they are served from when the router says: the build's
 * base, or what the app rewrote it to (TanStack Start's `transformAssets`,
 * as for a CDN). A chunk is recognized by the end of its URL.
 *
 * What the router does not say still works. Without a manifest the page gets
 * the translations of every chunk. A chunk the page loads that is not found
 * here, as that of a server component that is still loading when the page is
 * sent, has its files requested by the browser before its import runs.
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
  for (const { routeId, loaderData } of matches) {
    for (const link of [
      ...(routes[routeId]?.preloads ?? []),
      ...findClientReferenceChunks(loaderData),
    ]) {
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
        serverMessages,
        locale,
        translations,
      })
    : undefined;

export const createSplitShellSeed: typeof Disabled.createSplitShellSeed =
  async (router) => {
    if (!table) return undefined;
    const page = findPageChunks(router, table);
    // The shell is one page for every locale, so it holds the server's own
    // messages in each. Without such messages no catalog is read.
    const locales = serverMessages.length
      ? Object.values(table.entries).flatMap(({ state }) =>
          Object.keys(state.h)
        )
      : [];
    const catalogs = Object.assign(
      {},
      ...(await Promise.all([...new Set(locales)].map(getTranslationsSnapshot)))
    ) as Record<string, Record<string, unknown>>;
    return createChunkTranslationsShellSeed(table, {
      ...page,
      serverMessages,
      catalogs,
    });
  };

export const seedSplit: typeof Disabled.seedSplit = async () => undefined;

export const loadSplitTranslations: typeof Disabled.loadSplitTranslations =
  undefined;
