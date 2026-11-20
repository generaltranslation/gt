import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SplitPayload } from '../../split/types';

const loader = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  _addArrived: vi.fn(),
  _fetchJson: vi.fn(async () => ({ status: 'PRÊT' })),
  _register: vi.fn(),
  _requestEntry: vi.fn(async () => true),
  _takeArrived: vi.fn(() => ({ home: 'ACCUEIL' })),
  loadChunkTranslations: vi.fn(async () => undefined),
  loadRegionChunkTranslations: vi.fn(async () => undefined),
}));

vi.mock('gt-react/chunk-translations', () => ({
  ...loader,
  _getChunkTranslationsState: () => loader.state,
}));

const { hydrateSplit, splitLoadTranslations } =
  await import('../splitTranslations.client');

const START = {
  b: '/',
  f: 'assets/index-a1',
  h: { fr: '11' },
  v: { fr: '22' },
};

describe('what the browser does with what the server sent', () => {
  beforeEach(() => {
    loader.state = {};
    vi.clearAllMocks();
    vi.stubGlobal('requestIdleCallback', (run: () => void) => run());
  });

  it('registers the content of each file before it resolves, and lets the imports of the matched chunks run without a request', async () => {
    const payload: SplitPayload = {
      m: 'chunk',
      s: START,
      c: ['assets/reports-b2.js'],
      k: ['assets/reports-b2'],
      t: {
        e: {
          t: { home: 'ACCUEIL' },
          i: { k: ['assets/reports-b2'], c: [[1]] },
        },
        u: { status: 'PRÊT' },
        f: { 'assets/reports-b2': { reports: 'RAPPORTS' } },
      },
    };
    await hydrateSplit(payload, 'fr');
    expect(loader._register.mock.calls.map(([, , content]) => content)).toEqual(
      [{ home: 'ACCUEIL' }, { status: 'PRÊT' }, { reports: 'RAPPORTS' }]
    );
    expect(loader.state).toMatchObject({
      ...START,
      i: { k: ['assets/reports-b2'], c: [[1]] },
      s: { 'assets/reports-b2.js': 1 },
      y: true,
    });
    // The entry's file and the route's count as requested and arrived
    expect(
      await Promise.all(Object.values(loader.state.r as Promise<boolean>[]))
    ).toEqual([true, true]);
    expect(Object.keys(loader.state.r as object)).toEqual([
      'fr',
      'fr assets/reports-b2',
    ]);
    expect(loader._addArrived).toHaveBeenCalledWith(loader.state);
    expect(loader._requestEntry).not.toHaveBeenCalled();
  });

  it("loads the entry's files of the visitor's locale itself in a prerendered shell", async () => {
    const payload: SplitPayload = {
      m: 'module',
      a: {
        fr: {
          ...START,
          e: { fr: { 'assets/gt-0001': '44' } },
          u: 'assets/gt-unsplit',
          o: { fr: '33' },
        },
      },
    };
    await hydrateSplit(payload, 'fr');
    expect(loader._requestEntry).toHaveBeenCalledWith(loader.state, 'fr');
    expect(loader._fetchJson).toHaveBeenCalledWith(
      '/assets/gt-unsplit.fr.33.json'
    );
    expect(loader._register).toHaveBeenCalledWith(loader.state, 'fr', {
      status: 'PRÊT',
    });
    expect(loader.loadRegionChunkTranslations).toHaveBeenCalledWith([
      'assets/gt-0001',
    ]);
    expect(loader.state.y).toBe(true);
  });

  it('does nothing for a visitor of a shell whose locale has no files', async () => {
    await hydrateSplit({ m: 'chunk', a: { fr: START } }, 'en');
    expect(loader.state).toEqual({});
    expect(loader._requestEntry).not.toHaveBeenCalled();
  });

  it("gives the cache what has arrived for a locale, in place of the locale's catalog", async () => {
    expect(await splitLoadTranslations!('fr')).toEqual({ home: 'ACCUEIL' });
    expect(loader._takeArrived).toHaveBeenCalledWith(loader.state, 'fr');
  });
});
