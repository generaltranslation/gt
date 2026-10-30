import { describe, expect, it } from 'vitest';
import {
  LOCALE_TWIN_PLACEHOLDER_PREFIX,
  decodeLocaleTwinPlaceholder,
  encodeLocaleTwinPlaceholder,
  findLocaleTwinPlaceholders,
  isUnfilledLocaleTwinPlaceholder,
} from '../../internal';

const HASH_A = '0123456789abcdef';
const HASH_B = 'fedcba9876543210';

describe('encodeLocaleTwinPlaceholder', () => {
  it('encodes hashes and base64url source payload behind the prefix', () => {
    expect(encodeLocaleTwinPlaceholder({ [HASH_A]: 'Hello' })).toBe(
      '__GT_LOCALE_TWIN__:0123456789abcdef:WyJIZWxsbyJd'
    );
  });

  it('sorts hashes and aligns sources with them', () => {
    expect(encodeLocaleTwinPlaceholder({ [HASH_B]: 'b', [HASH_A]: 'a' })).toBe(
      `__GT_LOCALE_TWIN__:${HASH_A},${HASH_B}:${Buffer.from('["a","b"]').toString('base64url')}`
    );
  });

  it('uses the URL-safe alphabet without padding', () => {
    expect(encodeLocaleTwinPlaceholder({ [HASH_A]: 'Hi?>' })).toBe(
      '__GT_LOCALE_TWIN__:0123456789abcdef:WyJIaT8-Il0'
    );
    expect(encodeLocaleTwinPlaceholder({ [HASH_A]: '~~~' })).toBe(
      '__GT_LOCALE_TWIN__:0123456789abcdef:WyJ-fn4iXQ'
    );
  });

  it('rejects an empty entry set', () => {
    expect(() => encodeLocaleTwinPlaceholder({})).toThrow(/at least one/);
  });

  it('rejects hashes that are not 16 lowercase hex characters', () => {
    expect(() =>
      encodeLocaleTwinPlaceholder({ ABCDEF0123456789: 'x' })
    ).toThrow(/ABCDEF0123456789/);
    expect(() => encodeLocaleTwinPlaceholder({ abc: 'x' })).toThrow(/abc/);
  });
});

describe('decodeLocaleTwinPlaceholder', () => {
  it('round-trips ICU strings and JSX content, including non-Latin text', () => {
    const entries = {
      [HASH_A]: 'Hello, {name}! ÿÿÿ',
      [HASH_B]: [
        'Bonjour ',
        { t: 'b', i: 1, c: '世界 ✓' },
        { k: 'name', v: 'v', i: 2 },
      ],
    };
    expect(
      decodeLocaleTwinPlaceholder(encodeLocaleTwinPlaceholder(entries))
    ).toEqual(entries);
  });

  it('decodes a known-good placeholder', () => {
    expect(
      decodeLocaleTwinPlaceholder(
        '__GT_LOCALE_TWIN__:0123456789abcdef:WyJIaT8-Il0'
      )
    ).toEqual({ [HASH_A]: 'Hi?>' });
  });

  it('returns undefined for the bare prefix and other malformed values', () => {
    const payload = 'WyJIZWxsbyJd';
    for (const value of [
      LOCALE_TWIN_PLACEHOLDER_PREFIX,
      `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:`,
      `${LOCALE_TWIN_PLACEHOLDER_PREFIX}::${payload}`,
      `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:${HASH_A}`,
      `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:${HASH_A}:`,
      `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:0123456789ABCDEF:${payload}`,
      `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:0123456789abcde:${payload}`,
      // payload length does not match the hash count
      `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:${HASH_A},${HASH_B}:${payload}`,
      // hashes not sorted / duplicated
      `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:${HASH_B},${HASH_A}:${Buffer.from('["a","b"]').toString('base64url')}`,
      `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:${HASH_A},${HASH_A}:${Buffer.from('["a","a"]').toString('base64url')}`,
      // payload is not JSON / not an array
      `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:${HASH_A}:${Buffer.from('nope').toString('base64url')}`,
      `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:${HASH_A}:${Buffer.from('{"a":1}').toString('base64url')}`,
      // standard base64 characters are not part of the format
      `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:${HASH_A}:WyJIaT8+Il0=`,
      // surrounding text
      ` __GT_LOCALE_TWIN__:0123456789abcdef:WyJIZWxsbyJd`,
      `__GT_LOCALE_TWIN__:0123456789abcdef:WyJIZWxsbyJd `,
      '',
      '{"l":"en","e":{}}',
    ]) {
      expect(decodeLocaleTwinPlaceholder(value)).toBeUndefined();
    }
  });
});

describe('isUnfilledLocaleTwinPlaceholder', () => {
  it('accepts well-formed placeholders only', () => {
    expect(
      isUnfilledLocaleTwinPlaceholder(
        '__GT_LOCALE_TWIN__:0123456789abcdef:WyJIZWxsbyJd'
      )
    ).toBe(true);
    expect(
      isUnfilledLocaleTwinPlaceholder(LOCALE_TWIN_PLACEHOLDER_PREFIX)
    ).toBe(false);
    expect(isUnfilledLocaleTwinPlaceholder('{"l":"fr","e":{}}')).toBe(false);
    expect(isUnfilledLocaleTwinPlaceholder(undefined)).toBe(false);
    expect(isUnfilledLocaleTwinPlaceholder(42)).toBe(false);
  });
});

describe('findLocaleTwinPlaceholders', () => {
  const placeholder = '__GT_LOCALE_TWIN__:0123456789abcdef:WyJIZWxsbyJd';

  it.each([
    ['double quotes', '"'],
    ['single quotes', "'"],
    ['backticks', '`'],
  ] as const)(
    'finds a token in %s with offsets covering the quotes',
    (_, quote) => {
      const prefix = 'import{r as e}from"./x.js";e(';
      const code = `${prefix}${quote}${placeholder}${quote});`;
      expect(findLocaleTwinPlaceholders(code)).toEqual([
        {
          start: prefix.length,
          end: prefix.length + placeholder.length + 2,
          token: `${quote}${placeholder}${quote}`,
          quote,
          placeholder,
          hashes: [HASH_A],
          entries: { [HASH_A]: 'Hello' },
        },
      ]);
    }
  );

  it('finds every token in a chunk with mixed quote styles', () => {
    const second = encodeLocaleTwinPlaceholder({ [HASH_B]: 'Bye' });
    const code = `a("${placeholder}");b(\`${second}\`);c('${placeholder}')`;
    const found = findLocaleTwinPlaceholders(code);
    expect(found.map((m) => m.token)).toEqual([
      `"${placeholder}"`,
      `\`${second}\``,
      `'${placeholder}'`,
    ]);
    for (const m of found) {
      expect(code.slice(m.start, m.end)).toBe(m.token);
    }
  });

  it('never matches the bare prefix constant, quoted or not', () => {
    const code = [
      `const P="${LOCALE_TWIN_PLACEHOLDER_PREFIX}";`,
      `const Q='${LOCALE_TWIN_PLACEHOLDER_PREFIX}:';`,
      `const R=\`${LOCALE_TWIN_PLACEHOLDER_PREFIX}:\${x}\`;`,
      `v.startsWith(\`${LOCALE_TWIN_PLACEHOLDER_PREFIX}:\`)`,
    ].join('\n');
    expect(findLocaleTwinPlaceholders(code)).toEqual([]);
  });

  it('ignores unquoted placeholders, mismatched quotes and surrounding text', () => {
    const code = [
      `x(${placeholder});`,
      `x("${placeholder}');`,
      `x("a ${placeholder}");`,
      `x("${placeholder} b");`,
    ].join('\n');
    expect(findLocaleTwinPlaceholders(code)).toEqual([]);
  });

  it('ignores placeholders behind an escaped quote inside another string', () => {
    // JS source: x("say \"PH\"");  and  x('it\'PH');
    const code = [
      `x("say \\"${placeholder}\\"");`,
      `x('it\\'${placeholder}');`,
    ].join('\n');
    expect(findLocaleTwinPlaceholders(code)).toEqual([]);
  });

  it('treats a quote after an escaped backslash as a real quote', () => {
    // JS source: /\\'PH'/  (regex literal: escaped backslash, then a real quote)
    const code = `/\\\\'${placeholder}'/`;
    expect(findLocaleTwinPlaceholders(code)).toEqual([
      expect.objectContaining({ token: `'${placeholder}'` }),
    ]);
  });

  it('skips syntactically matching tokens whose payload is malformed', () => {
    const bad = `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:${HASH_A},${HASH_B}:WyJIZWxsbyJd`;
    expect(findLocaleTwinPlaceholders(`x("${bad}","${placeholder}")`)).toEqual([
      expect.objectContaining({ placeholder }),
    ]);
  });
});
