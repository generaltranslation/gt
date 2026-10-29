import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatAst, type MessageFormatElement } from '../../index';
import { parse } from '../../parser';
import { fromCompact, toCompact } from '../compactTree';
import { formatCompact } from '../formatCompact';

const due = new Date(Date.UTC(2025, 0, 15, 12, 30));
const variables = {
  name: 'Ada',
  n: 3,
  count: 1,
  place: 2,
  price: 1234.5,
  ratio: 0.25,
  role: 'admin',
  due,
  b: (parts: unknown[]) => `<b>${parts.join('')}</b>`,
};

// Every element kind, nesting, named and skeleton styles, offset and =N keys.
const messages = [
  'Save',
  'Hi {name}!',
  "It''s {name}'s turn",
  '{n, plural, =0 {none} one {# item} other {# items}}',
  '{n, plural, offset:1 =0 {nobody} one {you} other {you and # others}}',
  '{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
  '{role, select, admin {Admins} other {Everyone}}',
  '{count, plural, one {{role, select, admin {# admin} other {# member}}} other {many}}',
  '{price, number}',
  '{ratio, number, percent}',
  '{price, number, ::currency/EUR}',
  '{due, date, medium}',
  '{due, date, ::yyyyMMdd}',
  '{due, time}',
  '{due, time, short}',
  'Read <b>{name}</b> now',
];

describe('compact message tree prototype', () => {
  it.each(messages)('formats %j like formatAst', (message) => {
    const ast = parse(message);
    const expected = formatAst(ast, 'en', variables);
    expect(formatCompact(toCompact(ast), 'en', variables)).toEqual(expected);
    expect(formatAst(fromCompact(toCompact(ast)), 'en', variables)).toEqual(
      expected
    );
  });

  it('formats every shared wire fixture like formatAst', () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL(
          '../../../../../test-fixtures/icu-tree-wire-format.json',
          import.meta.url
        ),
        'utf8'
      )
    ) as { tree: MessageFormatElement[] }[];
    const values = new Proxy({}, { has: () => true, get: () => 2 });
    for (const { tree } of fixture) {
      const compact = toCompact(tree);
      expect(JSON.parse(JSON.stringify(compact))).toEqual(compact);
      expect(formatCompact(compact, 'en', values)).toEqual(
        formatAst(tree, 'en', values)
      );
    }
  });

  it('writes the shapes documented on CompactNode', () => {
    expect(toCompact(parse('Hi {name}!'))).toEqual(['Hi ', ['name'], '!']);
    expect(toCompact(parse('{n, plural, one {# item} other {items}}'))).toEqual(
      [['n', 'plural', { one: [0, ' item'], other: 'items' }]]
    );
    expect(toCompact(parse('{price, number, ::currency/USD}'))).toEqual([
      ['price', 'number', { style: 'currency', currency: 'USD' }],
    ]);
  });

  it('reports a missing branch like formatAst', () => {
    // The parser requires other, but an untrusted tree may omit it.
    const compact = [['role', 'select', { admin: 'A', user: 'U' }] as const];
    const errorOf = (format: () => unknown) => {
      try {
        format();
      } catch (error) {
        return error;
      }
    };
    const error = errorOf(() => formatCompact(compact, 'en', { role: 'x' }));
    expect(error).toEqual(
      errorOf(() => formatAst(fromCompact(compact), 'en', { role: 'x' }))
    );
    expect(String(error)).toContain('did not match any of: admin, user');
  });
});
