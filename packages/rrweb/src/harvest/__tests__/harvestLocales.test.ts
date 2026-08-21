import { EventType, IncrementalSource } from '@rrweb/types';
import type { eventWithTime } from '@rrweb/types';
import { describe, expect, it } from 'vitest';

import { collectRecordedText, recordingHasHashes } from '../harvestLocales';
import {
  foldObservations,
  newTargetDict,
  overlayFromDict,
} from '../structuralDict';

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
    const tree = el(1, 'DIV', [
      el(2, 'SPAN', [text(3, 'x')], {
        'data-_gt': 'H9',
        style: 'display:contents',
      }),
    ]);
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

describe('foldObservations + overlayFromDict', () => {
  // recorded nodes (id → source text) the overlay is mapped onto
  const recorded = new Map<number, string>([
    [10, 'Open'],
    [11, 'Open'],
    [12, 'Usage'],
    [13, 'General Translation'],
  ]);

  it('emits a translation when every occurrence agrees', () => {
    const d = newTargetDict();
    foldObservations(d, new Map([['a', 'Usage']]), new Map([['a', 'Uso']]));
    foldObservations(d, new Map([['b', 'Usage']]), new Map([['b', 'Uso']]));
    expect(overlayFromDict(d, recorded)[12]).toBe('Uso');
  });

  // Greptile P1: "Source-text keys merge translations"
  it('drops a source text with DIFFERENT translations across occurrences', () => {
    const d = newTargetDict();
    foldObservations(d, new Map([['a', 'Open']]), new Map([['a', 'Abrir']]));
    foldObservations(d, new Map([['b', 'Open']]), new Map([['b', 'Abierto']]));
    const ov = overlayFromDict(d, recorded);
    expect(ov[10]).toBeUndefined();
    expect(ov[11]).toBeUndefined();
  });

  // Greptile P1: "Skipped occurrences evade translation ambiguity checks"
  it('drops when translated in one place but untranslated in another (translated first)', () => {
    const d = newTargetDict();
    foldObservations(d, new Map([['a', 'Open']]), new Map([['a', 'Abrir']]));
    foldObservations(d, new Map([['b', 'Open']]), new Map([['b', 'Open']])); // untranslated
    expect(overlayFromDict(d, recorded)[10]).toBeUndefined();
  });

  it('drops when the untranslated occurrence comes first', () => {
    const d = newTargetDict();
    foldObservations(d, new Map([['a', 'Open']]), new Map([['a', 'Open']])); // untranslated
    foldObservations(d, new Map([['b', 'Open']]), new Map([['b', 'Abrir']]));
    expect(overlayFromDict(d, recorded)[10]).toBeUndefined();
  });

  it('treats a missing target key as untranslated (so it can trigger ambiguity)', () => {
    const d = newTargetDict();
    foldObservations(d, new Map([['a', 'Open']]), new Map([['a', 'Abrir']]));
    foldObservations(d, new Map([['b', 'Open']]), new Map()); // key absent in target
    expect(overlayFromDict(d, recorded)[10]).toBeUndefined();
  });

  it('renders source (no overlay entry) for consistently-untranslated text', () => {
    const d = newTargetDict();
    foldObservations(
      d,
      new Map([['a', 'General Translation']]),
      new Map([['a', 'General Translation']])
    );
    expect(overlayFromDict(d, recorded)[13]).toBeUndefined();
  });

  // Greptile P1: "Blank nodes shift translation keys". textByKey encodes each element's
  // non-blank text-node COUNT in the key (`path#idx/count`). When a position is blank in
  // one locale but text in the other, the counts differ so the keys DON'T align — the
  // source text must NOT pick up the mispositioned target translation.
  it('does NOT cross-pair when the non-blank text-node count differs across locales', () => {
    const rec = new Map<number, string>([[20, 'Later']]);
    const d = newTargetDict();
    // source element: [blank, "Later"] → 1 non-blank; target: ["Earlier", "Later"] → 2.
    foldObservations(
      d,
      new Map([['/DIV[1]#0/1', 'Later']]),
      new Map([
        ['/DIV[1]#0/2', 'Earlier target'],
        ['/DIV[1]#1/2', 'Later target'],
      ])
    );
    // "Later" must not become "Earlier target"; the count-mismatch leaves it on source.
    expect(overlayFromDict(d, rec)[20]).toBeUndefined();
  });

  // Greptile P1 (#216): a leading blank in the TARGET (same non-blank count) must still
  // pair correctly — the count in the key matches, so compacted indices align.
  it('pairs correctly when a target leading blank keeps the non-blank count equal', () => {
    const rec = new Map<number, string>([[21, 'Later']]);
    const d = newTargetDict();
    // source: ["Later"] → 1 non-blank; target: [blank, "Later"] → 1 non-blank.
    foldObservations(
      d,
      new Map([['/DIV[1]#0/1', 'Later']]),
      new Map([['/DIV[1]#0/1', 'Later target']])
    );
    expect(overlayFromDict(d, rec)[21]).toBe('Later target');
  });
});
