import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SplitRouter, SplitTable } from '../../split/types';

const { built, preload } = vi.hoisted(() => ({
  built: {} as { table: SplitTable },
  preload: vi.fn(),
}));

// What a build by chunk wrote: the import of the reports route needs its own
// file and the file of a chunk it shares with other routes
const TABLE: SplitTable = {
  firstVisit: 'inline',
  split: 'chunk',
  base: '/',
  states: {
    fr: { b: '/', f: 'assets/index-a1', h: { fr: '11' }, v: { fr: '22' } },
  },
  imports: {
    'assets/reports-b2.js': ['assets/shared-c3', 'assets/reports-b2'],
    'assets/settings-d4.js': ['assets/shared-c3', 'assets/settings-d4'],
  },
  files: {
    'assets/reports-b2': { fr: 'assets/reports-b2.fr.22.json' },
    'assets/settings-d4': { fr: 'assets/settings-d4.fr.22.json' },
    'assets/shared-c3': { fr: 'assets/shared-c3.fr.22.json' },
  },
  entry: { fr: 'assets/index-a1.fr.11.json' },
  entryChunk: 'assets/index-a1.js',
  entryKeys: [],
  unsplit: { fr: 'assets/gt-unsplit.fr.33.json' },
};
const CONTENTS = {
  'assets/index-a1.fr.11.json': { t: { home: 'ACCUEIL' } },
  'assets/gt-unsplit.fr.33.json': { status: 'PRÊT' },
  'assets/reports-b2.fr.22.json': { reports: 'RAPPORTS' },
  'assets/settings-d4.fr.22.json': { settings: 'RÉGLAGES' },
  'assets/shared-c3.fr.22.json': { shared: 'PARTAGÉ' },
};

vi.mock('gt-tanstack-start/internal/_split-table', () => ({
  get table() {
    return built.table;
  },
  loadContents: { fr: async () => ({ default: CONTENTS }) },
}));
vi.mock('react-dom', () => ({ preload }));

const { getSplitPayload, getSplitShellPayload, preloadSplitFiles } =
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
            { href: `${origin}/assets/reports-b2.js` },
            `${origin}/assets/shared-c3.js`,
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
    preload.mockClear();
  });

  it("is the content of the files the matched routes' chunks need, and of no other route's", async () => {
    expect(await getSplitPayload('fr', createRouter())).toEqual({
      m: 'chunk',
      s: TABLE.states.fr,
      c: ['assets/reports-b2.js'],
      k: ['assets/shared-c3', 'assets/reports-b2'],
      t: {
        e: CONTENTS['assets/index-a1.fr.11.json'],
        u: CONTENTS['assets/gt-unsplit.fr.33.json'],
        f: {
          'assets/shared-c3': CONTENTS['assets/shared-c3.fr.22.json'],
          'assets/reports-b2': CONTENTS['assets/reports-b2.fr.22.json'],
        },
      },
    });
  });

  it('is nothing for a locale that has no files, as the source locale', async () => {
    expect(await getSplitPayload('en', createRouter())).toBeUndefined();
  });

  it('finds the chunks behind URLs the app rewrote to another origin, and says where the files are', async () => {
    const payload = await getSplitPayload(
      'fr',
      createRouter('https://cdn.example.com/v1')
    );
    expect(payload?.c).toEqual(['assets/reports-b2.js']);
    expect(payload?.s?.b).toBe('https://cdn.example.com/v1/');
  });

  it('is every file when the router does not say which chunks the page loads', async () => {
    const payload = await getSplitPayload('fr', {});
    expect(payload?.c).toEqual(Object.keys(TABLE.imports));
    expect(Object.keys(payload?.t?.f ?? {}).sort()).toEqual(
      Object.keys(TABLE.files)
    );
  });

  it('is the URLs of those files with firstVisit: files, which the server asks the browser to preload', async () => {
    built.table = { ...TABLE, firstVisit: 'files' };
    const payload = await getSplitPayload('fr', createRouter());
    expect(payload).toMatchObject({
      p: [
        '/assets/index-a1.fr.11.json',
        '/assets/gt-unsplit.fr.33.json',
        '/assets/shared-c3.fr.22.json',
        '/assets/reports-b2.fr.22.json',
      ],
    });
    expect(payload).not.toHaveProperty('t');
    preloadSplitFiles(payload!);
    expect(preload.mock.calls).toEqual(
      payload!.p!.map((url) => [url, { as: 'fetch', crossOrigin: 'anonymous' }])
    );
  });

  it("is each locale's start state for a prerendered shell, which every visitor gets", () => {
    expect(
      getSplitShellPayload(createRouter('https://cdn.example.com'))
    ).toEqual({
      m: 'chunk',
      a: { fr: { ...TABLE.states.fr, b: 'https://cdn.example.com/' } },
    });
  });
});
