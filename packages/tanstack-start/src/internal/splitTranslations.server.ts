// The server's side of split translations. The server renders from the
// locale's whole catalog, as without the split. It only chooses what the page
// gets to hydrate with: the files of the client chunks of the matched routes,
// which it finds through the router's manifest.
import { preload } from 'react-dom';
import { loadContents, table } from 'gt-tanstack-start/internal/_split-table';
import type * as Disabled from './splitTranslations';
import type { SplitPayload, SplitRouter, SplitTable } from '../split/types';

/**
 * The client chunks of the matched routes, by their path from the build's
 * base, or undefined when the router does not say.
 */
function getMatchedChunks(
  router: SplitRouter,
  base: string
): string[] | undefined {
  const matches = router.state?.matches;
  const routes = router.ssr?.manifest?.routes;
  if (!matches || !routes) return undefined;
  const chunks = new Set<string>();
  for (const { routeId } of matches) {
    for (const link of routes[routeId]?.preloads ?? []) {
      const href = typeof link === 'string' ? link : link.href;
      // A chunk the app serves from elsewhere is not one the table knows
      if (href.startsWith(base)) chunks.add(href.slice(base.length));
    }
  }
  return [...chunks];
}

export const getSplitPayload: typeof Disabled.getSplitPayload = async (
  locale,
  router
) => {
  const built: SplitTable | undefined = table;
  const state = built?.states[locale];
  if (!built || !state) return undefined;
  // Without the router's manifest, the page gets every file
  const chunks =
    getMatchedChunks(router, built.base) ?? Object.keys(built.imports);
  const imported = chunks.filter((chunk) => built.imports[chunk]);
  const keys = [
    ...new Set([
      ...built.entryKeys,
      ...imported.flatMap((chunk) => built.imports[chunk]),
    ]),
  ].filter((key) => built.files[key]?.[locale]);
  const payload: SplitPayload = {
    m: built.split,
    s: state,
    c: imported,
    k: keys,
  };
  if (built.firstVisit === 'files') {
    const names = [
      built.entry[locale],
      built.unsplit[locale],
      ...keys.map((key) => built.files[key][locale]),
    ].filter((name) => name !== undefined);
    return { ...payload, p: names.map((name) => built.base + name) };
  }
  const contents = (await loadContents![locale]()).default;
  return {
    ...payload,
    t: {
      // The map of a build that splits by module holds no translations, and
      // no import of the matched routes waits for it
      ...(built.split === 'chunk' && { e: contents[built.entry[locale]] }),
      ...(built.unsplit[locale] && { u: contents[built.unsplit[locale]] }),
      f: Object.fromEntries(
        keys.map((key) => [key, contents[built.files[key][locale]]])
      ),
    },
  };
};

/**
 * A prerendered shell is one page for every visitor, so it gets what the
 * browser needs to load any locale's files itself, as a client-rendered app
 * does.
 */
export const getSplitShellPayload: typeof Disabled.getSplitShellPayload = () =>
  table && { m: table.split, a: table.states };

/**
 * Called while the server renders: React writes a preload link for each file
 * into the document's head, so the browser requests them with the page's
 * chunks, and the page's own requests for them are answered by those.
 */
export const preloadSplitFiles: typeof Disabled.preloadSplitFiles = (
  payload
) => {
  for (const url of payload.p ?? []) {
    preload(url, { as: 'fetch', crossOrigin: 'anonymous' });
  }
};

export const hydrateSplit: typeof Disabled.hydrateSplit = async () => undefined;

export const splitLoadTranslations: typeof Disabled.splitLoadTranslations =
  undefined;
