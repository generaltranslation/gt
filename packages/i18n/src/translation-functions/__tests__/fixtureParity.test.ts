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
  ordinal,
  time,
} from '../placeholders';
import type { MessageTreeMetadata } from '../renderMessage';

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
      '../../../../../test-fixtures/message-tree-wire-format.json',
      import.meta.url
    ),
    'utf8'
  )
);

// Capture what the real t builds instead of rendering it.
const captured = vi.hoisted(() => ({
  tree: undefined as unknown,
  hash: undefined as unknown,
}));
vi.mock('../renderMessage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../renderMessage')>();
  const { hashSource } = await import('generaltranslation/id');
  return {
    ...actual,
    renderMessage: (
      tree: MessageTree,
      _values: Record<string, unknown>,
      _formats: unknown,
      _locale: string,
      metadata: MessageTreeMetadata
    ) => {
      captured.tree = tree;
      captured.hash = hashSource({
        source: tree,
        dataFormat: 'MESSAGE_TREE',
        context: metadata.context,
        maxChars: metadata.maxChars,
        requiresReview: metadata.requiresReview,
      });
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
const currency: string = 'EUR';
const distance = 12.5;
const timeZone: string = 'Asia/Tokyo';
const start = new Date(0);
const lap = new Date(0);
const user = 'Ada';
const who = 'Grace';
const first = 'Ada';
const second = 'Grace';
const size: string = '2';

// Each case is the fixture `template`, written with the real helpers.
const cases: Record<string, (t: GT) => string> = {
  'plain-literal': (t) => t`Save`,
  context: (t) => t({ context: 'button' })`Save`,
  'one-argument': (t) => t`Hello, ${{ name }}!`,
  'max-chars': (t) => t({ maxChars: 12 })`Read more about pricing`,
  'max-chars-negative': (t) => t({ maxChars: -12 })`Read more about pricing`,
  'nested-plural-pound-select': (t) =>
    t`${plural(
      { count },
      {
        one: part`${n} new message for ${select({ role }, { admin: 'admins', other: 'everyone' })}`,
        other: part`${n} new messages for ${select({ role }, { admin: 'admins', other: 'all # members' })}`,
      }
    )}`,
  'plural-exact-key-order': (t) =>
    t`${plural({ count }, { '=2': 'A pair', '=10': 'Ten items', other: part`${n} items` })}`,
  ordinal: (t) =>
    t`You finished ${ordinal({ place }, { one: part`${n}st`, two: part`${n}nd`, few: part`${n}rd`, other: part`${n}th` })}!`,
  'number-intl-options': (t) =>
    t`Total: ${number({ price }, { style: 'currency', currency: 'USD' })}`,
  'number-currency-dynamic': (t) =>
    t`Total: ${number({ price }, { style: 'currency', currency, currencyDisplay: 'code' })}`,
  'number-unit': (t) =>
    t`${number({ distance }, { style: 'unit', unit: 'kilometer', maximumFractionDigits: 1 })} away`,
  date: (t) => t`Due ${date({ due }, { style: 'medium' })}`,
  'date-style-dynamic-time-zone': (t) =>
    t`Due ${date({ due }, { style: 'medium', timeZone })}`,
  'time-style': (t) => t`Starts at ${time({ start }, { style: 'short' })}`,
  'date-fields-hour': (t) =>
    t`Due ${date({ due }, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
  'time-fractional-seconds': (t) =>
    t`Lap time: ${time({ lap }, { minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}`,
  'time-day-period': (t) =>
    t`See you ${time({ start }, { hour: 'numeric', dayPeriod: 'long' })}`,
  derive: (t) => t`Welcome ${derive('back')}, ${{ user }}!`,
  anonymous: (t) => t`Hi ${name}!`,
  'anonymous-numbering': (t) => t`${first} meets ${second} today`,
  'anonymous-helper-values': (t) =>
    t`${plural(count, { one: 'One file', other: part`${n} files` })} for ${select(role, { admin: 'admins', other: 'everyone' })}, ${number(price, { style: 'percent' })} by ${date(due)} from ${name}`,
  'literal-icu-syntax': (t) =>
    t`Don't stop, '{team}' ${derive("O'Brien {x} #1")} and ${{ name }}`,
  'part-in-branch': (t) =>
    t`${plural(
      { count },
      {
        '=0': 'No messages',
        one: part`${n} message from ${{ who }}`,
        other: part`${n} messages from ${{ who }}`,
      }
    )}`,
  'select-integer-like-keys': (t) =>
    t`${select({ size }, { 10: 'ten', 2: 'two', other: 'many' })}`,
  'requires-review': (t) => t({ requiresReview: true })`Delete account`,
};

describe('message-tree-wire-format fixture parity', () => {
  const t = createGT({ getLocale: () => 'en' });

  beforeEach(() => {
    captured.tree = undefined;
    captured.hash = undefined;
  });

  it.each(fixtures)('$name: $template', ({ name, tree, hash }) => {
    cases[name](t);
    // JSON round trip compares plain data, as stored in a catalog.
    expect(JSON.parse(JSON.stringify(captured.tree))).toEqual(tree);
    expect(isMessageTree(captured.tree)).toBe(true);
    expect(captured.hash).toBe(hash);
  });
});
