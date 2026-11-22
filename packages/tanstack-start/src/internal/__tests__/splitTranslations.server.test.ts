import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SplitTranslationsOutput } from 'generaltranslation/internal';
import type { SplitRouter } from '../splitTranslations';

const { built } = vi.hoisted(() => ({
  built: {} as { table: SplitTranslationsOutput | undefined },
}));

// What the compiler hands the plugin of a build by chunk: the import of the
// reports route needs its own file and the file of a chunk it shares with
// other routes
const TABLE: SplitTranslationsOutput = {
  entries: {
    'assets/index-a1.js': {
      state: {
        b: '/',
        f: 'assets/index-a1',
        h: { fr: '11' },
        v: { fr: '22' },
      },
      messages: ['home'],
      files: [],
    },
  },
  imports: {
    'assets/reports-b2.js': ['assets/shared-c3', 'assets/reports-b2'],
    'assets/settings-d4.js': ['assets/shared-c3', 'assets/settings-d4'],
  },
  files: {
    'assets/reports-b2': ['reports'],
    'assets/settings-d4': ['settings'],
    'assets/shared-c3': ['shared'],
  },
  unsplit: ['status'],
};
// The catalog the server renders with
const CATALOG = {
  home: 'ACCUEIL',
  status: 'PRÊT',
  reports: 'RAPPORTS',
  settings: 'RÉGLAGES',
  shared: 'PARTAGÉ',
  server: 'SERVEUR',
};

vi.mock('gt-tanstack-start/internal/_split-table', () => ({
  get table() {
    return built.table;
  },
}));

const { createSplitSeed, createSplitShellSeed, findPageChunks } =
  await import('../splitTranslations.server');

/** A router whose matched routes preload the chunks at `origin`. */
const createRouter = (origin = ''): SplitRouter => ({
  state: { matches: [{ routeId: '__root__' }, { routeId: '/reports' }] },
  ssr: {
    manifest: {
      routes: {
        __root__: { preloads: [`${origin}/assets/index-a1.js`] },
        '/reports': {
          preloads: [
            { href: `${origin}/assets/reports-b2.js?v=1` },
            // A chunk without messages
            `${origin}/assets/vendor-c3.js`,
          ],
        },
        '/settings': { preloads: [`${origin}/assets/settings-d4.js`] },
      },
    },
  },
});

describe('what the server sends with a page', () => {
  beforeEach(() => {
    built.table = TABLE;
  });

  it.each([
    ['the root', '', '/'],
    ['a base', '/app', '/app/'],
    [
      'another origin, as a CDN the app rewrites its assets to',
      'https://cdn.example.com/v1',
      'https://cdn.example.com/v1/',
    ],
  ])(
    'finds the chunks of the matched routes in the manifest of a router that serves them from %s',
    (_name, origin, base) => {
      expect(findPageChunks(createRouter(origin), TABLE)).toEqual({
        chunks: ['assets/index-a1.js', 'assets/reports-b2.js'],
        base,
      });
    }
  );

  it('adds the chunks of the client components that a server component of a matched route renders', () => {
    const router = createRouter();
    expect(
      findPageChunks(
        {
          ...router,
          state: {
            matches: [
              { routeId: '__root__' },
              {
                routeId: '/reports',
                // As TanStack Start keeps a server component in loader data
                loaderData: {
                  Panel: {
                    [Symbol.for('tanstack.rsc.jsPreloads')]: new Set([
                      '/assets/settings-d4.js',
                      '/assets/index-a1.js',
                    ]),
                  },
                },
              },
            ],
          },
        },
        TABLE
      ).chunks
    ).toEqual([
      'assets/index-a1.js',
      'assets/reports-b2.js',
      'assets/settings-d4.js',
    ]);
  });

  it('takes every chunk whose import needs translations when the router has no manifest', () => {
    expect(findPageChunks({}, TABLE)).toEqual({
      chunks: ['assets/reports-b2.js', 'assets/settings-d4.js'],
      base: undefined,
    });
  });

  it('seeds a page with the translations of the matched routes and of the unsplit messages, and with where its files are served from', () => {
    expect(
      createSplitSeed(createRouter('https://cdn.example.com'), 'fr', CATALOG)
    ).toEqual({
      s: {
        b: 'https://cdn.example.com/',
        f: 'assets/index-a1',
        h: { fr: '11' },
        v: { fr: '22' },
      },
      t: {
        home: 'ACCUEIL',
        shared: 'PARTAGÉ',
        reports: 'RAPPORTS',
        status: 'PRÊT',
      },
      c: ['assets/reports-b2.js'],
      k: ['assets/shared-c3', 'assets/reports-b2'],
    });
  });

  it('seeds a prerendered shell with where the files of every locale are, and no translations', () => {
    expect(createSplitShellSeed(createRouter('/app'))).toEqual({
      s: { b: '/app/', f: 'assets/index-a1', h: { fr: '11' }, v: { fr: '22' } },
    });
  });

  it.each([
    ['a locale the build has no files for', 'de', CATALOG, TABLE],
    ['a locale whose catalog did not load', 'fr', undefined, TABLE],
    ['a build that does not split translations', 'fr', CATALOG, undefined],
  ])('sends nothing for %s', (_name, locale, translations, table) => {
    built.table = table;
    expect(
      createSplitSeed(createRouter(), locale, translations)
    ).toBeUndefined();
  });
});
