import { EventType, IncrementalSource } from '@rrweb/types';
import type { eventWithTime } from '@rrweb/types';
import { describe, expect, it, vi } from 'vitest';

import {
  collectHashNodes,
  collectRecordedText,
  flattenEntry,
  harvestHash,
  harvestLocales,
  overlayFromDict,
  recordingHasHashes,
  stringOverlay,
  type GtJsxChildren,
  type TranslationDict,
} from '../harvest';

// ----- minimal serialized-node + event builders (only fields the harvest reads) ----- //

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
const mutation = (
  adds: { node: Ser }[] = [],
  texts: { id: number; value: string }[] = []
): eventWithTime =>
  ({
    type: EventType.IncrementalSnapshot,
    data: {
      source: IncrementalSource.Mutation,
      adds,
      texts,
      removes: [],
      attributes: [],
    },
    timestamp: 1,
  }) as unknown as eventWithTime;

// ===================================================================================
describe('flattenEntry', () => {
  it('returns null for a null/undefined entry (untranslated)', () => {
    expect(flattenEntry(null)).toBeNull();
    expect(flattenEntry(undefined)).toBeNull();
  });

  it('flattens a bare string (STRING/ICU message) to one text leaf', () => {
    expect(flattenEntry('Hola')).toEqual([{ text: 'Hola' }]);
  });

  it('flattens each JSX child string as its own leaf, in order', () => {
    expect(flattenEntry(['Bienvenido ', 'de nuevo'])).toEqual([
      { text: 'Bienvenido ' },
      { text: 'de nuevo' },
    ]);
  });

  it('recurses into element children ({ t, c })', () => {
    const entry: GtJsxChildren = [
      'Bienvenido ',
      { t: 'strong', c: ['Juan'] },
      ' a nuestra ',
      { t: 'a', c: ['aplicación'] },
    ];
    expect(flattenEntry(entry)).toEqual([
      { text: 'Bienvenido ' },
      { text: 'Juan' },
      { text: ' a nuestra ' },
      { text: 'aplicación' },
    ]);
  });

  it('emits a variable placeholder for a variable node ({ k })', () => {
    expect(flattenEntry(['Hola ', { i: 1, k: 'name', v: 'v' }])).toEqual([
      { text: 'Hola ' },
      { variable: true },
    ]);
  });

  it('treats an HTML void element as zero leaves (e.g. <br/>)', () => {
    expect(flattenEntry([{ t: 'br' }, 'x'])).toEqual([{ text: 'x' }]);
  });

  it('treats a childless value-rendering component as a placeholder leaf', () => {
    const entry: GtJsxChildren = [
      { t: 'LocalizedDateTime', i: 1 },
      ' – ',
      { t: 'LocalizedDateTime', i: 2 },
    ];
    expect(flattenEntry(entry)).toEqual([
      { variable: true },
      { text: ' – ' },
      { variable: true },
    ]);
  });

  it('returns null for a plural/branch (no single rendered form)', () => {
    const entry: GtJsxChildren = [
      {
        t: 'span',
        i: 1,
        d: { t: 'p', b: { one: ['1 item'], other: ['n items'] } },
      },
    ];
    expect(flattenEntry(entry)).toBeNull();
  });

  it('strips GT field separators (U+001C-U+001F) from string leaves', () => {
    expect(flattenEntry('abc')).toEqual([{ text: 'abc' }]);
  });
});

// ===================================================================================
describe('collectRecordedText', () => {
  it('maps rrweb id → text for non-blank text nodes in the FullSnapshot', () => {
    const tree = el(1, 'DIV', [
      text(2, 'Hello'),
      el(3, 'SPAN', [text(4, 'World')]),
      text(5, '   '), // whitespace-only → skipped
    ]);
    const map = collectRecordedText([fullSnapshot(tree)]);
    expect(map.get(2)).toBe('Hello');
    expect(map.get(4)).toBe('World');
    expect(map.has(5)).toBe(false);
  });

  it('includes mutation-added nodes and later text changes', () => {
    const events = [
      fullSnapshot(el(1, 'DIV', [text(2, 'A')])),
      mutation(
        [{ node: el(6, 'P', [text(7, 'Added')]) }],
        [{ id: 2, value: 'A2' }]
      ),
    ];
    const map = collectRecordedText(events);
    expect(map.get(7)).toBe('Added');
    expect(map.get(2)).toBe('A2'); // characterData change overrides the snapshot text
  });
});

describe('recordingHasHashes', () => {
  it('true when any node carries data-_gt-hash', () => {
    const tree = el(1, 'DIV', [
      el(2, 'SPAN', [text(3, 'x')], { 'data-_gt-hash': 'abc123' }),
    ]);
    expect(recordingHasHashes([fullSnapshot(tree)])).toBe(true);
  });

  it('true for the runtime-wrapper attribute (data-_gt string hash)', () => {
    const tree = el(1, 'DIV', [hashSpan(2, 'H9', [text(3, 'x')])]);
    expect(recordingHasHashes([fullSnapshot(tree)])).toBe(true);
  });

  it('false when no node carries the hash attribute', () => {
    expect(
      recordingHasHashes([fullSnapshot(el(1, 'DIV', [text(2, 'x')]))])
    ).toBe(false);
  });

  it('ignores a non-hash object-valued data-_gt (defensive)', () => {
    const tree = el(1, 'DIV', [
      el(2, 'SPAN', [text(3, 'x')], { 'data-_gt': '[object Object]' }),
    ]);
    expect(recordingHasHashes([fullSnapshot(tree)])).toBe(false);
  });
});

// ===================================================================================
describe('collectHashNodes', () => {
  it('collects each hash node with its descendant text nodes in order (untrimmed)', () => {
    const tree = el(1, 'MAIN', [
      hashSpan(2, 'H1', [
        text(3, 'Welcome '),
        el(4, 'STRONG', [text(5, 'John')]),
      ]),
      el(6, 'DIV', [hashSpan(7, 'H2', [text(8, 'Usage')])]),
    ]);
    expect(collectHashNodes([fullSnapshot(tree)])).toEqual([
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
    expect(overlayFromDict(nodes, { H1: ['just one'] })).toEqual({});
  });

  it('does not emit a leaf whose translation equals the source', () => {
    const dict: TranslationDict = { H1: ['Welcome ', { t: 'b', c: ['Juan'] }] };
    const ov = overlayFromDict(nodes, dict);
    expect(ov[3]).toBeUndefined();
    expect(ov[5]).toBe('Juan');
  });
});

describe('stringOverlay', () => {
  const recorded = new Map<number, string>([
    [1, 'Projects'],
    [2, 'Usage'],
    [3, 'Untranslated'],
    [4, 'Same'],
  ]);
  const hash = (m: string) => `h:${m}`;
  const dict: TranslationDict = {
    'h:Projects': 'Proyectos',
    'h:Usage': 'Uso',
    'h:Same': 'Same', // translation equals source → skip
  };

  it('translates bare strings by hashing their source text', () => {
    expect(stringOverlay(recorded, new Set(), dict, hash)).toEqual({
      1: 'Proyectos',
      2: 'Uso',
    });
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

// ===================================================================================
describe('harvestHash', () => {
  const events = [
    fullSnapshot(el(1, 'MAIN', [hashSpan(2, 'H1', [text(3, 'Usage')])])),
  ];

  it('builds an overlay per target locale, skipping the source', async () => {
    const dicts: Record<string, TranslationDict> = {
      es: { H1: ['Uso'] },
      fr: { H1: ['Utilisation'] },
    };
    const loadTranslations = vi.fn(
      async (locale: string) => dicts[locale] ?? {}
    );
    const overlay = await harvestHash(events, ['en', 'es', 'fr'], {
      source: 'en',
      loadTranslations,
    });
    expect(overlay).toEqual({ es: { 3: 'Uso' }, fr: { 3: 'Utilisation' } });
    expect(loadTranslations).not.toHaveBeenCalledWith('en');
  });

  it('falls back to an empty overlay for a locale whose loader rejects', async () => {
    const loadTranslations = vi.fn(async (locale: string) => {
      if (locale === 'es') throw new Error('offline');
      return { H1: ['Utilisation'] } as TranslationDict;
    });
    const overlay = await harvestHash(events, ['en', 'es', 'fr'], {
      source: 'en',
      loadTranslations,
    });
    expect(overlay.es).toEqual({});
    expect(overlay.fr).toEqual({ 3: 'Utilisation' });
  });

  it('combines <T> content with bare gt() strings when hashMessage is given', () => {
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
      loadTranslations: async () => dict,
      hashMessage: (m: string) => `h:${m}`,
    }).then((overlay) => {
      expect(overlay.es).toEqual({ 3: 'Uso', 5: 'Proyectos' });
    });
  });
});

// ===================================================================================
describe('harvestLocales', () => {
  const events = [
    fullSnapshot(el(1, 'MAIN', [hashSpan(2, 'H1', [text(3, 'Usage')])])),
  ];

  it('returns an empty overlay when no loadTranslations is provided', async () => {
    expect(await harvestLocales(events, ['en', 'es'])).toEqual({});
  });

  it('harvests via loadTranslations, treating locales[0] as the source', async () => {
    const overlay = await harvestLocales(events, ['en', 'es'], {
      loadTranslations: async () => ({ H1: ['Uso'] }),
    });
    expect(overlay).toEqual({ es: { 3: 'Uso' } });
  });

  it('honors an explicit sourceLocale', async () => {
    const overlay = await harvestLocales(events, ['en', 'es'], {
      sourceLocale: 'es', // es is now the source → only 'en' is a target
      loadTranslations: async () => ({ H1: ['Usage EN'] }),
    });
    expect(Object.keys(overlay)).toEqual(['en']);
  });
});
