import { afterEach, describe, it, expect, vi } from 'vitest';
import { gtFallback } from '../gtFallback';
import { mFallback } from '../mFallback';

describe.each([
  ['gtFallback', gtFallback],
  ['mFallback', mFallback],
])('%s', (_name, fallback) => {
  it('returns a message unchanged without options and interpolates variables', () => {
    expect(fallback('Hello, world!')).toBe('Hello, world!');
    expect(fallback('Hello, {name}!', { name: 'Alice' })).toBe('Hello, Alice!');
  });

  it('passes null and undefined messages through', () => {
    expect(fallback(null as unknown as string)).toBeNull();
    expect(fallback(undefined as unknown as string)).toBeUndefined();
  });
});

describe('gtFallback declareVar support', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves declareVars in source-only (fallback) mode', () => {
    // No $_fallback set, so the unindexed selects resolve to their own values.
    expect(
      gtFallback(
        'I play with {_gt_, select, other {toys}} at the {_gt_, select, other {park}}',
        {}
      )
    ).toBe('I play with toys at the park');
  });

  // The source ($_fallback) carries the declared values; the translation
  // refers to them by index.
  it.each([
    [
      'an indexed argument',
      'Hello {_gt_, select, other {John}}!',
      'Bonjour {_gt_1} !',
      {},
      'Bonjour John !',
    ],
    [
      'an indexed select, which is condensed',
      'Hello {_gt_, select, other {John}}!',
      'Bonjour {_gt_1, select, other {}} !',
      {},
      'Bonjour John !',
    ],
    [
      'literal pounds next to a condensed select',
      'Hello {_gt_, select, other {Ada}}!',
      "{_gt_1, select, other {}}: {count, plural, other {'##'}}",
      { count: 7 },
      'Ada: ##',
    ],
    [
      'reordered variables',
      'I play with {_gt_, select, other {toys}} at the {_gt_, select, other {park}}',
      'Je joue au {_gt_2} avec des {_gt_1}',
      {},
      'Je joue au park avec des toys',
    ],
    [
      'user variables next to declared ones',
      '{name} bought {_gt_, select, other {3 apples}} and {_gt_, select, other {2 oranges}}',
      '{name} a acheté {_gt_1} et {_gt_2}',
      { name: 'Bob' },
      'Bob a acheté 3 apples et 2 oranges',
    ],
    [
      'an empty declared value',
      'Hello {_gt_, select, other {}}!',
      'Bonjour {_gt_1} !',
      {},
      'Bonjour  !',
    ],
    [
      'a source without declareVar markers',
      'Hello {name}!',
      'Bonjour {name} !',
      { name: 'Alice' },
      'Bonjour Alice !',
    ],
  ])(
    'formats a translation with %s',
    (_name, source, translation, variables, expected) => {
      expect(
        gtFallback(translation, { ...variables, $_fallback: source })
      ).toBe(expected);
    }
  );

  it('retries with the source, keeping user variables, when the translation cannot be formatted', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(
      gtFallback('Bonjour {name, bad_syntax, other {}} {_gt_1}!', {
        name: 'Alice',
        $_fallback:
          'Hello {name}, welcome to {_gt_, select, other {the park}}!',
      })
    ).toBe('Hello Alice, welcome to the park!');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('String interpolation failed')
    );
  });

  it('returns the raw message when it cannot be formatted and there is no fallback', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(gtFallback('{bad, bad_syntax, other {}}', {})).toBe(
      '{bad, bad_syntax, other {}}'
    );
  });
});
