import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MessageTree } from '@generaltranslation/icu';
import { messageTreeToIcu } from '@generaltranslation/icu/convert';
import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { legacySourceCandidates } from '../candidates.js';
import { gtjsxToMessage, legacyIcuToMessage } from '../legacy.js';

type MessageTreeCase = {
  name: string;
  options: { context?: string; maxChars?: number; requiresReview?: boolean };
  tree: MessageTree;
  hash: string;
};

type RichContentCase = { id: string; source: unknown[] };

const fixture = <T>(name: string): T =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../../../test-fixtures/${name}`, import.meta.url),
      'utf8'
    )
  ) as T;

const messageTreeCases = fixture<MessageTreeCase[]>(
  'message-tree-wire-format.json'
);
const richContentCases = fixture<RichContentCase[]>(
  'rich-content-wire-format.json'
);

const legacyHash = (icu: string, options: MessageTreeCase['options']) =>
  hashSource({ source: indexVars(icu), dataFormat: 'ICU', ...options });

const predicts = (
  tree: MessageTree,
  options: MessageTreeCase['options'],
  hash: string
) =>
  legacySourceCandidates(tree).some(
    ({ source, dataFormat }) =>
      hashSource({ source, dataFormat, ...options }) === hash
  );

const ANONYMOUS_ARGUMENT = /\{_gt_\d+\}/g;

describe('message tree wire fixture', () => {
  it('has every case', () => {
    expect(messageTreeCases).toHaveLength(25);
  });

  it.each(messageTreeCases)(
    'migrates $name from its legacy ICU',
    ({ options, tree, hash }) => {
      const icu = messageTreeToIcu(tree);
      const result = legacyIcuToMessage(icu);
      expect(result).toEqual({ ok: true, tree, formats: {} });
      expect(JSON.stringify(result.ok && result.tree)).toBe(
        JSON.stringify(tree)
      );
      expect(
        hashSource({ source: tree, dataFormat: 'MESSAGE_TREE', ...options })
      ).toBe(hash);
      expect(predicts(tree, options, legacyHash(icu, options))).toBe(true);
    }
  );

  it.each(
    messageTreeCases.filter(({ tree }) => {
      const icu = messageTreeToIcu(tree);
      return /\{_gt_\d+\}/.test(icu) && !/\{_gt_\d+,/.test(icu);
    })
  )('migrates $name from legacy declared variables', ({ options, tree }) => {
    const icu = messageTreeToIcu(tree).replace(
      ANONYMOUS_ARGUMENT,
      '{_gt_, select, other {value}}'
    );
    expect(legacyIcuToMessage(icu)).toEqual({ ok: true, tree, formats: {} });
    expect(predicts(tree, options, legacyHash(icu, options))).toBe(true);
  });
});

describe('rich content wire fixture', () => {
  const byId = (id: string) =>
    richContentCases.find((entry) => entry.id === id)!.source;

  it.each<[string, unknown, unknown]>([
    [
      'nested-element',
      byId('nested-element'),
      {
        ok: false,
        reason:
          'It contains <strong>; only <Plural> and <Branch> elements have a message tree form',
      },
    ],
    [
      'typed-variables',
      byId('typed-variables'),
      {
        ok: true,
        tree: [
          'Hello ',
          ['_gt_value_1'],
          ', you have ',
          ['_gt_n_2', 'number'],
          ' messages.',
        ],
        formats: {},
      },
    ],
    [
      'independent-branch-numbering',
      byId('independent-branch-numbering'),
      {
        ok: false,
        reason:
          'It contains <strong>; only <Plural> and <Branch> elements have a message tree form',
      },
    ],
    [
      'independent-plural-numbering',
      byId('independent-plural-numbering'),
      {
        ok: false,
        reason:
          'It contains <span>; only <Plural> and <Branch> elements have a message tree form',
      },
    ],
    [
      'independent-plural-numbering without its span',
      byId('independent-plural-numbering')[0],
      {
        ok: true,
        tree: [
          [
            '_gt_plural_1',
            'plural',
            {
              one: ['One ', ['_gt_n_2', 'number']],
              other: ['Many ', ['_gt_n_2', 'number']],
            },
          ],
        ],
        formats: {},
      },
    ],
  ])('converts %s', (_id, source, expected) => {
    expect(gtjsxToMessage(source)).toEqual(expected);
  });

  it('covers every case', () => {
    expect(richContentCases.map(({ id }) => id)).toEqual([
      'nested-element',
      'typed-variables',
      'independent-branch-numbering',
      'independent-plural-numbering',
    ]);
  });
});
