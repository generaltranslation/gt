import { describe, it, expect } from 'vitest';
import type { JsxChildren } from '@generaltranslation/format';
import { hashSource, hashString } from '../hashSource';

describe('hashString', () => {
  it.each([
    ['test string', 'd5579c46dfcc7f18', '1VecRt_Mfxg'],
    ['', 'e3b0c44298fc1c14', '47DEQpj8HBQ'],
  ])(
    'encodes the 64 bits of the earlier hex hash of %j as base64url',
    (input, hex, hash) => {
      expect(hashString(input)).toBe(hash);
      expect(Buffer.from(hex, 'hex').toString('base64url')).toBe(hash);
    }
  );
});

describe('hashSource rich wire literals', () => {
  it.each([
    [false, '2Y2IhqMcmPM'],
    [true, 'c7ayEaQSK6g'],
    [null, 'RxuRJMMYF-k'],
    [{ t: 'div', i: 1, c: false }, 'oBPABUg83Rk'],
    [{ t: 'div', i: 1, c: true }, 'IA20-8q8fQY'],
    [{ t: 'div', i: 1, c: { t: 'span', i: 2, c: null } }, '2O8sKwo4Sug'],
    [
      {
        t: 'Branch',
        i: 1,
        d: { t: 'b', b: { active: false, empty: null } },
      },
      '84XaPnk9lYs',
    ],
  ] satisfies ReadonlyArray<readonly [JsxChildren, string]>)(
    'preserves the React hash for %j',
    (source, expected) => {
      expect(hashSource({ dataFormat: 'JSX', source })).toBe(expected);
    }
  );
});

describe('hashSource variables', () => {
  const hash = (variable: JsxChildren) =>
    hashSource({ dataFormat: 'JSX', source: ['Total: ', variable].flat() });

  it('hashes the type and the name of a variable, not its id', () => {
    expect(hash({ i: 1, v: 'n' })).toBe(hash({ i: 7, v: 'n' }));
    expect(hash({ i: 1, v: 'n' })).not.toBe(hash({ i: 1, v: 'c' }));
    expect(hash({ i: 1, v: 'n' })).not.toBe(hash({ i: 1, k: 'count', v: 'n' }));
  });

  it('keeps the hash of a named variable', () => {
    expect(hash({ i: 1, k: 'count', v: 'n' })).toBe('QsNQlSK3jmE');
  });
});

describe('hashSource requiresReview', () => {
  it('hashes identically when requiresReview is false or absent (ICU)', () => {
    const base = hashSource({ source: 'Hello world', dataFormat: 'ICU' });
    const explicitFalse = hashSource({
      source: 'Hello world',
      requiresReview: false,
      dataFormat: 'ICU',
    });
    expect(explicitFalse).toBe(base);
  });

  it('hashes identically when requiresReview is false or absent (JSX)', () => {
    const source = ['Hello ', { c: ['world'] }];
    const base = hashSource({ source, dataFormat: 'JSX' });
    const explicitFalse = hashSource({
      source,
      requiresReview: false,
      dataFormat: 'JSX',
    });
    expect(explicitFalse).toBe(base);
  });

  it('produces a different hash when requiresReview is true', () => {
    const base = hashSource({ source: 'Hello world', dataFormat: 'ICU' });
    const reviewed = hashSource({
      source: 'Hello world',
      requiresReview: true,
      dataFormat: 'ICU',
    });
    expect(reviewed).not.toBe(base);
  });

  it('composes with other metadata without disturbing their hashes', () => {
    const withContext = hashSource({
      source: 'Hello world',
      context: 'nav',
      dataFormat: 'ICU',
    });
    const withContextAndReview = hashSource({
      source: 'Hello world',
      context: 'nav',
      requiresReview: true,
      dataFormat: 'ICU',
    });
    const withContextAndFalseReview = hashSource({
      source: 'Hello world',
      context: 'nav',
      requiresReview: false,
      dataFormat: 'ICU',
    });
    expect(withContextAndFalseReview).toBe(withContext);
    expect(withContextAndReview).not.toBe(withContext);
  });

  it('does not change legacy hashes (pinned values)', () => {
    // Pinned pre-requiresReview hashes: if these change, every existing
    // project would retranslate on upgrade.
    expect(hashSource({ source: 'Hello world', dataFormat: 'ICU' })).toBe(
      'Bah7zhUdJYs'
    );
    expect(
      hashSource({ source: ['Hello ', { c: ['world'] }], dataFormat: 'JSX' })
    ).toBe('LvAS-yfl8Bk');
  });
});

describe('hashSource fileFormat', () => {
  const source = '# Hello\n\nA short document.';

  it('hashes a document differently from the identical plain string', () => {
    const plain = hashSource({ source, dataFormat: 'STRING' });
    const md = hashSource({ source, dataFormat: 'STRING', fileFormat: 'MD' });
    const mdx = hashSource({ source, dataFormat: 'STRING', fileFormat: 'MDX' });
    expect(new Set([plain, md, mdx]).size).toBe(3);
  });

  it('leaves existing hashes untouched when fileFormat is absent', () => {
    expect(hashSource({ source: 'Hello world', dataFormat: 'ICU' })).toBe(
      hashSource({
        source: 'Hello world',
        dataFormat: 'ICU',
        fileFormat: undefined,
      })
    );
  });
});
