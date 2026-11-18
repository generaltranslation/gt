import { describe, it, expect } from 'vitest';
import type { JsxChildren } from '@generaltranslation/format';
import { hashSource } from '../hashSource';

describe('hashSource rich wire literals', () => {
  it.each([
    [false, 'd98d8886a31c98f3'],
    [true, '73b6b211a4122ba8'],
    [null, '471b9124c31817e9'],
    [{ t: 'div', i: 1, c: false }, 'a013c005483cdd19'],
    [{ t: 'div', i: 1, c: true }, '200db4fbcabc7d06'],
    [{ t: 'div', i: 1, c: { t: 'span', i: 2, c: null } }, 'd8ef2c2b0a384ae8'],
    [
      {
        t: 'Branch',
        i: 1,
        d: { t: 'b', b: { active: false, empty: null } },
      },
      'f385da3e793d958b',
    ],
  ] satisfies ReadonlyArray<readonly [JsxChildren, string]>)(
    'preserves the React hash for %j',
    (source, expected) => {
      expect(hashSource({ dataFormat: 'JSX', source })).toBe(expected);
    }
  );

  it('hashes an ordinal plural differently from a cardinal one', () => {
    const plural = (t: 'p' | 'o'): JsxChildren => ({
      t: 'Plural',
      i: 1,
      d: { t, b: { one: '1st', other: 'nth' } },
    });
    expect(hashSource({ dataFormat: 'JSX', source: plural('o') })).not.toBe(
      hashSource({ dataFormat: 'JSX', source: plural('p') })
    );
  });
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
    expect(hash({ i: 1, k: 'count', v: 'n' })).toBe('42c3509522b78e61');
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
      '05a87bce151d258b'
    );
    expect(
      hashSource({ source: ['Hello ', { c: ['world'] }], dataFormat: 'JSX' })
    ).toBe('2ef012fb27e5f019');
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
