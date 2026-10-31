import { readFileSync } from 'node:fs';
import { isMessageTree, type MessageTree } from '@generaltranslation/icu';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGT, type GT, type GTOptions } from '../gt';
import {
  date,
  derive,
  n,
  number,
  part,
  plural,
  select,
  selectordinal,
} from '../placeholders';

type TreeWireFormatFixture = {
  name: string;
  template: string;
  options: GTOptions;
  tree: MessageTree;
  hash: string;
};

const fixtures: TreeWireFormatFixture[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../test-fixtures/icu-tree-wire-format.json',
      import.meta.url
    ),
    'utf8'
  )
);

// Capture what the real gt builds instead of rendering it.
const captured = vi.hoisted(() => ({
  tree: undefined as unknown,
  hash: undefined as unknown,
}));
vi.mock('../renderMessage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../renderMessage')>();
  return {
    ...actual,
    renderMessage: (
      tree: MessageTree,
      _values: Record<string, unknown>,
      _locale: string,
      metadata: Parameters<typeof actual.hashMessage>[1]
    ) => {
      captured.tree = tree;
      captured.hash = actual.hashMessage(tree, metadata);
      return '';
    },
  };
});

const name = 'Ada';
const count = 3;
const role = 'admin' as 'admin' | 'member';
const place = 2;
const price = 9.5;
const due = new Date(0);
const user = 'Ada';
const who = 'Grace';
const first = 'Ada';
const second = 'Grace';
const size: string = '2';

// Each case is the fixture `template`, written with the real helpers.
const cases: Record<string, (gt: GT) => string> = {
  'plain-literal': (gt) => gt`Save`,
  context: (gt) => gt({ context: 'button' })`Save`,
  'one-argument': (gt) => gt`Hello, ${{ name }}!`,
  'max-chars': (gt) => gt({ maxChars: 12 })`Read more about pricing`,
  'max-chars-negative': (gt) => gt({ maxChars: -12 })`Read more about pricing`,
  'nested-plural-pound-select': (gt) =>
    gt`${plural(
      { count },
      {
        one: part`${n} new message for ${select({ role }, { admin: 'admins', other: 'everyone' })}`,
        other: part`${n} new messages for ${select({ role }, { admin: 'admins', other: 'all # members' })}`,
      }
    )}`,
  'plural-exact-key-order': (gt) =>
    gt`${plural({ count }, { '=2': 'A pair', '=10': 'Ten items', other: part`${n} items` })}`,
  selectordinal: (gt) =>
    gt`You finished ${selectordinal({ place }, { one: part`${n}st`, two: part`${n}nd`, few: part`${n}rd`, other: part`${n}th` })}!`,
  'number-intl-options': (gt) =>
    gt`Total: ${number({ price }, { style: 'currency', currency: 'USD' })}`,
  date: (gt) => gt`Due ${date({ due }, { dateStyle: 'medium' })}`,
  derive: (gt) => gt`Welcome ${derive('back')}, ${{ user }}!`,
  anonymous: (gt) => gt`Hi ${name}!`,
  'anonymous-numbering': (gt) => gt`${first} meets ${second} today`,
  'anonymous-helper-values': (gt) =>
    gt`${plural(count, { one: 'One file', other: part`${n} files` })} for ${select(role, { admin: 'admins', other: 'everyone' })}, ${number(price, { style: 'percent' })} by ${date(due)} from ${name}`,
  'literal-icu-syntax': (gt) =>
    gt`Don't stop, '{team}' ${derive("O'Brien {x} #1")} and ${{ name }}`,
  'part-in-branch': (gt) =>
    gt`${plural(
      { count },
      {
        '=0': 'No messages',
        one: part`${n} message from ${{ who }}`,
        other: part`${n} messages from ${{ who }}`,
      }
    )}`,
  'select-integer-like-keys': (gt) =>
    gt`${select({ size }, { 10: 'ten', 2: 'two', other: 'many' })}`,
  'requires-review': (gt) => gt({ requiresReview: true })`Delete account`,
};

describe('icu-tree-wire-format fixture parity', () => {
  const gt = createGT({ getLocale: () => 'en' });

  beforeEach(() => {
    captured.tree = undefined;
    captured.hash = undefined;
  });

  it.each(fixtures)('$name: $template', ({ name, tree, hash }) => {
    cases[name](gt);
    // JSON round trip compares plain data, as stored in a catalog.
    expect(JSON.parse(JSON.stringify(captured.tree))).toEqual(tree);
    expect(isMessageTree(captured.tree)).toBe(true);
    expect(captured.hash).toBe(hash);
  });
});
