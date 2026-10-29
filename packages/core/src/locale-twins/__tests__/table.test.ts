import { describe, expect, it } from 'vitest';
import {
  encodeLocaleTwinPlaceholder,
  parseLocaleTwinTable,
  serializeLocaleTwinTable,
} from '../../internal';

const HASH_A = '0123456789abcdef';
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

describe('serializeLocaleTwinTable', () => {
  it('produces a double-quoted JS string literal holding the table JSON', () => {
    expect(
      serializeLocaleTwinTable({ l: 'fr', e: { [HASH_A]: 'Bonjour' } })
    ).toBe(
      '"{\\"l\\":\\"fr\\",\\"e\\":{\\"0123456789abcdef\\":\\"Bonjour\\"}}"'
    );
  });

  it('escapes line and paragraph separators so the literal is safe in any JS parser', () => {
    const token = serializeLocaleTwinTable({
      l: 'en',
      e: { [HASH_A]: `a${LS}b${PS}c` },
    });
    expect(token).not.toContain(LS);
    expect(token).not.toContain(PS);
    expect(token).toContain('a\\u2028b\\u2029c');
    expect(JSON.parse(token)).toBe(
      `{"l":"en","e":{"${HASH_A}":"a${LS}b${PS}c"}}`
    );
  });
});

describe('parseLocaleTwinTable', () => {
  it('parses the runtime value of a serialized token back into the table', () => {
    const table = {
      l: 'ja',
      e: {
        [HASH_A]: ['こんにちは ', { t: 'b', i: 1, c: '世界' }],
        fedcba9876543210: `a${LS}b "quoted" \`tick\` 'single' \\`,
      },
    };
    // The browser evaluates the token; JSON.parse models that evaluation.
    const runtimeValue = JSON.parse(serializeLocaleTwinTable(table));
    expect(parseLocaleTwinTable(runtimeValue)).toEqual(table);
  });

  it('accepts an empty entry table', () => {
    expect(parseLocaleTwinTable('{"l":"en","e":{}}')).toEqual({
      l: 'en',
      e: {},
    });
  });

  it('throws a diagnostic for unfilled placeholders and malformed tables', () => {
    for (const value of [
      encodeLocaleTwinPlaceholder({ [HASH_A]: 'Hello' }),
      'not json',
      '[]',
      'null',
      '{"e":{}}',
      '{"l":"","e":{}}',
      '{"l":"fr"}',
      '{"l":"fr","e":[]}',
      '{"l":"fr","e":null}',
    ]) {
      expect(() => parseLocaleTwinTable(value)).toThrow(
        /^generaltranslation Error: .*locale twin table/
      );
    }
  });
});
