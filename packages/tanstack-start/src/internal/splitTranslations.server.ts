// The server's side of split translations. The server renders from the
// locale's whole catalog, as without the split. It only chooses what the page
// gets to hydrate with: the files of the client chunks of the matched routes,
// which it finds through the router's manifest.
import { preload } from 'react-dom';
import { loadContents, table } from 'gt-tanstack-start/internal/_split-table';
import type * as Disabled from './splitTranslations';
import type { SplitPayload, SplitRouter, SplitTable } from '../split/types';

/**
 * The client chunks a router's manifest names for the matched routes, by
 * their path from the build's base, and the URL they are served from: the
 * build's base, or what the app rewrote it to (TanStack Start's
 * `transformAssets`, as for a CDN). Undefined when the router does not say.
 */
function findChunks(
  router: SplitRouter,
  built: SplitTable
): { chunks: string[]; base: string } | undefined {
  const matches = router.state?.matches;
  const routes = router.ssr?.manifest?.routes;
  if (!matches || !routes) return undefined;
  const known = new Set([built.entryChunk, ...Object.keys(built.imports)]);
  const chunks = new Set<string>();
  let base: string | undefined;
  for (const { routeId } of matches) {
    for (const link of routes[routeId]?.preloads ?? []) {
      const [href] = (typeof link === 'string' ? link : link.href).split(
        /[?#]/
      );
      if (href.startsWith(built.base)) {
        chunks.add(href.slice(built.base.length));
        continue;
      }
      // The longest end of the URL that is a chunk of the build
      const segments = href.split('/');
      for (let start = 1; start < segments.length; start++) {
        const chunk = segments.slice(start).join('/');
        if (!known.has(chunk)) continue;
        chunks.add(chunk);
        base ??= href.slice(0, href.length - chunk.length);
        break;
      }
    }
  }
  return { chunks: [...chunks], base: base ?? built.base };
}

export const getSplitPayload: typeof Disabled.getSplitPayload = async (
  locale,
  router
) => {
  const built: SplitTable | undefined = table;
  const state = built?.states[locale];
  if (!built || !state) return undefined;
  // Without the router's manifest, the page gets every file
  const { chunks, base } = findChunks(router, built) ?? {
    chunks: Object.keys(built.imports),
    base: built.base,
  };
  const imported = chunks.filter((chunk) => built.imports[chunk]);
  const keys = [
    ...new Set([
      ...built.entryKeys,
      ...imported.flatMap((chunk) => built.imports[chunk]),
    ]),
  ].filter((key) => built.files[key]?.[locale]);
  const payload: SplitPayload = {
    m: built.split,
    s: { ...state, b: base },
    c: imported,
    k: keys,
  };
  if (built.firstVisit === 'files') {
    const names = [
      built.entry[locale],
      built.unsplit[locale],
      ...keys.map((key) => built.files[key][locale]),
    ].filter((name) => name !== undefined);
    return { ...payload, p: names.map((name) => base + name) };
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
export const getSplitShellPayload: typeof Disabled.getSplitShellPayload = (
  router
) => {
  const built: SplitTable | undefined = table;
  if (!built) return undefined;
  const base = findChunks(router, built)?.base ?? built.base;
  return {
    m: built.split,
    a: Object.fromEntries(
      Object.entries(built.states).map(([locale, state]) => [
        locale,
        { ...state, b: base },
      ])
    ),
  };
};

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
