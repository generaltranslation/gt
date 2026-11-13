import { describe, expect, test } from 'vitest';
import {
  jsonChunks,
  parseJsonBytes,
  StreamedJson,
} from '../../src/compiler/utils/json.js';

const snippet = { before: 'a\n"b"', target: '\tm.greeting()', after: '' };

/** Shaped like a metadata file, with every kind of JSON value. */
const metadata = {
  greeting: { sourceCode: { 'src/a.ts': [snippet, snippet] } },
  nav: {
    home: {
      context: 'The home link',
      maxChars: 12,
      sourceCode: { 'src/{weird}.ts': [snippet], 'src/b.ts': [] },
    },
  },
  empty: {},
  list: [1, 'two', null, undefined, [], [{ deep: [{ deeper: [3] }] }]],
  skipped: undefined,
  '1': 'an index key',
  ['__proto__']: { own: true },
  unicode: `é 中 😀 ${String.fromCodePoint(0x2028)}`,
};

describe('jsonChunks', () => {
  test('writes a StreamedJson as the chunks it gives at its indentation', () => {
    const value = {
      a: new StreamedJson((indent) => [
        `[\n${indent}  1`,
        Buffer.from(`\n${indent}]`),
      ]),
    };

    expect(
      [...jsonChunks(value)].map((chunk) => chunk.toString()).join('')
    ).toBe(JSON.stringify({ a: [1] }, null, 2));
  });

  test.each([
    ['a metadata file', metadata],
    ['an empty object', {}],
    ['an empty array', []],
    ['a string', 'text'],
    ['null', null],
  ])('is JSON.stringify(value, null, 2) in pieces: %s', (_, value) => {
    expect([...jsonChunks(value)].map(String).join('')).toBe(
      JSON.stringify(value, null, 2)
    );
  });
});

describe('parseJsonBytes', () => {
  const omitsNothing = () => false;
  const omitsEverything = () => true;

  const documents = [
    JSON.stringify(metadata, null, 2),
    JSON.stringify(metadata),
    ' { "a" : [ 1 , 2.5e3 , -0 , true , false , null , "]}\\"{[" ] , "b" : { } , "c" : [ ] } \n',
    '{"x":{"y":{"z":"\\u00e9\\\\"}},"x":"duplicate"}',
  ];

  test.each(documents)(
    'parses what JSON.parse does, member by member when it is long: %#',
    (text) => {
      const bytes = Buffer.from(text);

      expect(parseJsonBytes(bytes, omitsNothing)).toEqual(JSON.parse(text));
      expect(parseJsonBytes(bytes, omitsNothing, 1)).toEqual(JSON.parse(text));
    }
  );

  test('leaves out the omitted key paths of objects too long to parse at once, none in arrays', () => {
    const text = JSON.stringify(metadata, null, 2);
    const omitted = new Set(['greeting/sourceCode', 'list/5/0/deep']);
    const parsed = parseJsonBytes(
      Buffer.from(text),
      (keyPath) => omitted.has(keyPath.join('/')),
      64
    );

    const expected = JSON.parse(text);
    delete expected.greeting.sourceCode;
    expect(parsed).toEqual(expected);
    expect(Object.hasOwn(parsed!, '__proto__')).toBe(true);
  });

  test.each([
    '{"a": 1,}',
    '[1,]',
    '{"a" 1}',
    '{"a": tru}',
    '{"a": {"b": [1, tru]}}',
    '{"a": 1} extra',
    '{"a": "unterminated}',
    '﻿{"a": 1}',
    '[1, 2]',
  ])('gives undefined for what is not a JSON object: %s', (text) => {
    const bytes = Buffer.from(text);

    expect(parseJsonBytes(bytes, omitsNothing)).toBeUndefined();
    expect(parseJsonBytes(bytes, omitsNothing, 1)).toBeUndefined();
    // Members that are left out are checked too.
    expect(parseJsonBytes(bytes, omitsEverything, 1)).toBeUndefined();
  });
});
