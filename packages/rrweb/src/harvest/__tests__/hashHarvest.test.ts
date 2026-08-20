import { EventType, IncrementalSource } from '@rrweb/types';
import type { eventWithTime } from '@rrweb/types';
import { describe, expect, it, vi } from 'vitest';

import {
  collectHashNodes,
  harvestHash,
  overlayFromDict,
  stringOverlay,
} from '../hashHarvest';
import type { TranslationDict } from '../gtjson';

// ----- minimal serialized-node + event builders ----- //

type Ser = {
  type: number;
  id: number;
  tagName?: string;
  textContent?: string;
  attributes?: Record<string, unknown>;
  childNodes?: Ser[];
};
const text = (id: number, t: string): Ser => ({ type: 3, id, textContent: t });
const el = (
  id: number,
  tagName: string,
  childNodes: Ser[] = [],
  attributes: Record<string, unknown> = {}
): Ser => ({ type: 2, id, tagName, attributes, childNodes });
/** A tag-ids wrapper: <span data-_gt={hash} style="display:contents">…</span>. */
const hashSpan = (id: number, hash: string, childNodes: Ser[]): Ser =>
  el(id, 'SPAN', childNodes, { 'data-_gt': hash, style: 'display:contents' });

const fullSnapshot = (node: Ser): eventWithTime =>
  ({
    type: EventType.FullSnapshot,
    data: { node },
    timestamp: 0,
  }) as unknown as eventWithTime;
const mutation = (adds: { node: Ser }[] = []): eventWithTime =>
  ({
    type: EventType.IncrementalSnapshot,
    data: {
      source: IncrementalSource.Mutation,
      adds,
      texts: [],
      removes: [],
      attributes: [],
    },
    timestamp: 1,
  }) as unknown as eventWithTime;

describe('collectHashNodes', () => {
  it('collects each hash node with its descendant text nodes in order (untrimmed)', () => {
    const tree = el(1, 'MAIN', [
      hashSpan(2, 'H1', [
        text(3, 'Welcome '),
        el(4, 'STRONG', [text(5, 'John')]),
      ]),
      el(6, 'DIV', [hashSpan(7, 'H2', [text(8, 'Usage')])]),
    ]);
    const nodes = collectHashNodes([fullSnapshot(tree)]);
    expect(nodes).toEqual([
      {
        hash: 'H1',
        textNodes: [
          { id: 3, text: 'Welcome ' },
          { id: 5, text: 'John' },
        ],
      },
      { hash: 'H2', textNodes: [{ id: 8, text: 'Usage' }] },
    ]);
  });

  it('emits only the OUTERMOST node of a nested pair', () => {
    const tree = el(1, 'MAIN', [
      hashSpan(2, 'OUTER', [
        text(3, 'a '),
        hashSpan(4, 'INNER', [text(5, 'b')]),
      ]),
    ]);
    const nodes = collectHashNodes([fullSnapshot(tree)]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].hash).toBe('OUTER');
    expect(nodes[0].textNodes.map((t) => t.id)).toEqual([3, 5]);
  });

  it('finds hash nodes added by later mutations (interaction-only states)', () => {
    const nodes = collectHashNodes([
      fullSnapshot(el(1, 'MAIN', [])),
      mutation([{ node: hashSpan(9, 'H3', [text(10, 'Later')]) }]),
    ]);
    expect(nodes).toEqual([
      { hash: 'H3', textNodes: [{ id: 10, text: 'Later' }] },
    ]);
  });
});

describe('overlayFromDict', () => {
  const nodes = collectHashNodes([
    fullSnapshot(
      el(1, 'MAIN', [
        hashSpan(2, 'H1', [text(3, 'Welcome '), el(4, 'B', [text(5, 'John')])]),
        hashSpan(6, 'HVAR', [
          text(7, 'Hello '),
          el(8, 'SPAN', [text(9, 'Ian')]),
        ]),
      ])
    ),
  ]);

  it('aligns translated leaves onto the recorded text nodes by position', () => {
    const dict: TranslationDict = {
      H1: ['Bienvenido ', { t: 'b', c: ['Juan'] }],
    };
    expect(overlayFromDict(nodes, dict)).toEqual({
      3: 'Bienvenido ',
      5: 'Juan',
    });
  });

  it('keeps the recorded value for a variable leaf (does not translate it)', () => {
    // 'Hello <Var>{name}</Var>' → 'Hola {name}': node 7 → 'Hola ', node 9 (var) untouched.
    const dict: TranslationDict = {
      HVAR: ['Hola ', { i: 1, k: 'name', v: 'v' }],
    };
    const ov = overlayFromDict(nodes, dict);
    expect(ov[7]).toBe('Hola ');
    expect(ov[9]).toBeUndefined();
  });

  it('skips an untranslated hash (dict entry null/absent)', () => {
    expect(overlayFromDict(nodes, { H1: null })).toEqual({});
    expect(overlayFromDict(nodes, {})).toEqual({});
  });

  it('skips when the leaf count does not match the recorded text-node count', () => {
    // H1 has 2 text nodes; a 1-leaf entry must not be force-fit.
    expect(overlayFromDict(nodes, { H1: ['just one'] })).toEqual({});
  });

  it('does not emit a leaf whose translation equals the source', () => {
    const dict: TranslationDict = {
      H1: ['Welcome ', { t: 'b', c: ['Juan'] }], // first leaf unchanged
    };
    const ov = overlayFromDict(nodes, dict);
    expect(ov[3]).toBeUndefined();
    expect(ov[5]).toBe('Juan');
  });
});

describe('stringOverlay', () => {
  // recorded id → source text for bare (non-<T>) nodes, e.g. gt()/useGT() labels
  const recorded = new Map<number, string>([
    [1, 'Projects'],
    [2, 'Usage'],
    [3, 'Untranslated'],
    [4, 'Same'],
  ]);
  // fake hasher: message → hash (only the recorder needs the REAL gt hashMessage)
  const hash = (m: string) => `h:${m}`;
  const dict: TranslationDict = {
    'h:Projects': 'Proyectos',
    'h:Usage': 'Uso',
    'h:Same': 'Same', // translation equals source → skip
    // 'h:Untranslated' absent → skip
  };

  it('translates bare strings by hashing their source text', () => {
    const ov = stringOverlay(recorded, new Set(), dict, hash);
    expect(ov).toEqual({ 1: 'Proyectos', 2: 'Uso' });
  });

  it('skips nodes already covered by the <T> path', () => {
    const ov = stringOverlay(recorded, new Set([1]), dict, hash);
    expect(ov[1]).toBeUndefined();
    expect(ov[2]).toBe('Uso');
  });

  it('leaves a string on source when its hasher throws', () => {
    const throwing = () => {
      throw new Error('no hasher');
    };
    expect(stringOverlay(recorded, new Set(), dict, throwing)).toEqual({});
  });
});

describe('harvestHash', () => {
  const events = [
    fullSnapshot(el(1, 'MAIN', [hashSpan(2, 'H1', [text(3, 'Usage')])])),
  ];

  it('builds an overlay per target locale, skipping the source', async () => {
    const dicts: Record<string, TranslationDict> = {
      es: { H1: ['Uso'] },
      fr: { H1: ['Utilisation'] },
    };
    const getTranslations = vi.fn(
      async (locale: string) => dicts[locale] ?? {}
    );
    const overlay = await harvestHash(events, ['en', 'es', 'fr'], {
      source: 'en',
      getTranslations,
    });
    expect(overlay).toEqual({ es: { 3: 'Uso' }, fr: { 3: 'Utilisation' } });
    expect(getTranslations).toHaveBeenCalledWith('es');
    expect(getTranslations).toHaveBeenCalledWith('fr');
    expect(getTranslations).not.toHaveBeenCalledWith('en');
  });

  it('falls back to an empty overlay for a locale whose loader rejects', async () => {
    const getTranslations = vi.fn(async (locale: string) => {
      if (locale === 'es') throw new Error('offline');
      return { H1: ['Utilisation'] } as TranslationDict;
    });
    const overlay = await harvestHash(events, ['en', 'es', 'fr'], {
      source: 'en',
      getTranslations,
    });
    expect(overlay.es).toEqual({});
    expect(overlay.fr).toEqual({ 3: 'Utilisation' });
  });

  it('combines <T> content with bare gt() strings when hashMessage is given', () => {
    // 'Usage' inside a <T> (hash H1); 'Projects' as a bare gt() label (node 5).
    const mixed = [
      fullSnapshot(
        el(1, 'MAIN', [
          hashSpan(2, 'H1', [text(3, 'Usage')]),
          el(4, 'NAV', [text(5, 'Projects')]),
        ])
      ),
    ];
    const dict: TranslationDict = { H1: ['Uso'], 'h:Projects': 'Proyectos' };
    return harvestHash(mixed, ['en', 'es'], {
      source: 'en',
      getTranslations: async () => dict,
      hashMessage: (m: string) => `h:${m}`,
    }).then((overlay) => {
      // node 3 via the <T> hash path, node 5 via the string-hash path
      expect(overlay.es).toEqual({ 3: 'Uso', 5: 'Proyectos' });
    });
  });
});
