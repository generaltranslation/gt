import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it, vi } from 'vitest';
import { formatMessageTree, type MessageTree } from '../index';
import { icuToMessageTree } from '../convert';
import { formatMessage } from '../parser';

describe('formatMessageTree', () => {
  it('matches formatMessage for a localized currency', () => {
    expect(
      formatMessageTree(
        icuToMessageTree('{n, number, currency}'),
        'de',
        { n: 1234.5 },
        { formats: { n: { currency: 'EUR' } } }
      )
    ).toEqual(
      formatMessage('{n, number, ::currency/EUR}', 'de', { n: 1234.5 })
    );
  });

  it('defaults to the library locale and empty variables', () => {
    expect(formatMessageTree('Hi')).toBe('Hi');
    expect(formatMessageTree('')).toBe('');
  });

  it('returns a message without placeholders as its text, never as ICU', () => {
    expect(formatMessageTree("It's {cool} #", 'en', {})).toBe("It's {cool} #");
    // Valid but not canonical: an array of only text formats the same.
    expect(formatMessageTree(['Sa', 've'])).toBe('Save');
    expect(formatMessageTree([])).toBe('');
  });

  it('formats every node kind', () => {
    const tree: MessageTree = [
      ['n', 'plural', { one: [0, ' item'], other: [0, ' items'] }],
      ', ',
      ['place', 'selectordinal', { one: [0, 'st'], other: [0, 'th'] }],
      ', ',
      ['role', 'select', { admin: 'admins', other: 'everyone' }],
      ', ',
      ['p', 'number', 'percent'],
      ', ',
      ['d', 'date', 'medium'],
      ', ',
      ['b', 'tag', ['bold ', ['name']]],
    ];
    expect(
      formatMessageTree(
        tree,
        'en',
        {
          n: 2,
          place: 1,
          role: 'admin',
          p: 0.5,
          d: Date.UTC(2025, 0, 15),
          name: 'Ada',
          b: (parts: unknown[]) => `<b>${parts.join('')}</b>`,
        },
        { timeZone: 'UTC' }
      )
    ).toBe('2 items, 1st, admins, 50%, Jan 15, 2025, <b>bold Ada</b>');
  });

  it('subtracts a plural offset before choosing a category and printing #', () => {
    const tree: MessageTree = [
      ['n', 'plural', { '=0': 'nobody', one: 'you', other: [0, ' others'] }, 1],
    ];
    expect(formatMessageTree(tree, 'en', { n: 0 })).toBe('nobody');
    expect(formatMessageTree(tree, 'en', { n: 2 })).toBe('you');
    expect(formatMessageTree(tree, 'en', { n: 4 })).toBe('3 others');
  });

  it('reports a value no branch matches', () => {
    expect(() =>
      formatMessageTree([['s', 'select', { a: 'A' }]], 'en', { s: 'b' })
    ).toThrow('did not match any of: a');
  });

  it('validates locales like formatMessage instead of using the host locale', () => {
    const tree: MessageTree = ['Hi'];
    const errorOf = (format: () => unknown): unknown => {
      try {
        format();
      } catch (error) {
        return error;
      }
      throw new Error('expected an invalid-locale error');
    };
    for (const locales of [[], 'not a locale!', ['en', 'x!']]) {
      expect(errorOf(() => formatMessageTree(tree, locales))).toEqual(
        errorOf(() => formatMessage('Hi', locales))
      );
    }
    expect(() => formatMessageTree(tree, [])).toThrow(TypeError);
    expect(() => formatMessageTree(tree, 'not a locale!')).toThrow(RangeError);
  });

  it('resolves a locale once, not on every call', () => {
    const supportedLocalesOf = vi.spyOn(
      Intl.NumberFormat,
      'supportedLocalesOf'
    );
    try {
      // A locale no other test uses, so it is not cached yet.
      for (let i = 0; i < 3; i++) {
        expect(formatMessageTree(['Hi ', ['n']], 'se-NO', { n: 'Ada' })).toBe(
          'Hi Ada'
        );
      }
      expect(supportedLocalesOf).toHaveBeenCalledTimes(1);
    } finally {
      supportedLocalesOf.mockRestore();
    }
  });
});

describe('formatting context', () => {
  const d = new Date(Date.UTC(2025, 0, 15, 23, 30));
  const tree: MessageTree = [
    ['d', 'date', 'medium'],
    ' ',
    ['t', 'time', 'short'],
    ' ',
    ['p', 'number', 'percent'],
  ];
  const intl = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', options).format(d);

  it("merges each variable's formats over its style", () => {
    expect(
      formatMessageTree(
        tree,
        'en-US',
        { d, t: d, p: 0.125 },
        {
          formats: {
            d: { timeZone: 'Asia/Tokyo', calendar: 'japanese' },
            t: { timeZone: 'UTC', hourCycle: 'h23' },
            p: { maximumFractionDigits: 1 },
          },
        }
      )
    ).toBe(
      `${intl({ dateStyle: 'medium', timeZone: 'Asia/Tokyo', calendar: 'japanese' })} ${intl({ timeStyle: 'short', timeZone: 'UTC', hourCycle: 'h23' })} 12.5%`
    );
  });

  it("uses the default time zone where a variable's formats set none", () => {
    expect(
      formatMessageTree(
        tree,
        'en-US',
        { d, t: d, p: 1 },
        {
          formats: { t: { timeZone: 'UTC' } },
          timeZone: 'Asia/Tokyo',
        }
      )
    ).toBe(
      `${intl({ dateStyle: 'medium', timeZone: 'Asia/Tokyo' })} ${intl({ timeStyle: 'short', timeZone: 'UTC' })} 100%`
    );
  });

  // As in ICU, an argument without a style is in the medium style.
  it('formats a date or time without a style as the medium style', () => {
    for (const locale of ['en-US', 'de', 'ja']) {
      expect(
        formatMessageTree(
          [['d', 'date'], ' ', ['d', 'time']],
          locale,
          { d },
          { timeZone: 'UTC' }
        )
      ).toBe(
        `${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(d)} ${new Intl.DateTimeFormat(locale, { timeStyle: 'medium', timeZone: 'UTC' }).format(d)}`
      );
    }
  });

  it('formats named date and time styles as Intl dateStyle and timeStyle', () => {
    for (const style of ['full', 'long', 'medium', 'short'] as const) {
      expect(
        formatMessageTree(
          [['d', 'date', style], ' ', ['d', 'time', style]],
          'en-US',
          { d },
          { timeZone: 'UTC' }
        )
      ).toBe(
        `${intl({ dateStyle: style, timeZone: 'UTC' })} ${intl({ timeStyle: style, timeZone: 'UTC' })}`
      );
    }
  });

  it('requires a currency for the currency style', () => {
    expect(() =>
      formatMessageTree([['t', 'number', 'currency']], 'en', { t: 5 })
    ).toThrow(
      'The ICU variable "t" is formatted as currency, but no currency was given.'
    );
    expect(
      formatMessageTree(
        [['t', 'number', 'currency']],
        'en',
        { t: 5 },
        { formats: { t: { currency: 'EUR' } } }
      )
    ).toBe('€5.00');
  });

  it("reads only a variable's own formats", () => {
    expect(
      formatMessageTree(
        [['toString', 'number']],
        'en',
        { toString: 1234 },
        {
          formats: {},
        }
      )
    ).toBe('1,234');
  });
});

describe('empty branches', () => {
  // An empty branch adds no part, so a lone rich value is returned as is and
  // a tag callback receives no children, matching intl-messageformat.
  const rich = { rich: true };
  it.each([
    '{s, select, yes {} other {fallback}}{x}',
    '{n, plural, =1 {} other {fallback}}{x}',
    '{n, plural, one {} other {fallback}}{x}',
    '{n, selectordinal, one {} other {fallback}}{x}',
  ])('adds no part for an empty branch in %j', (message) => {
    const values = { s: 'yes', n: 1, x: rich };
    expect(formatMessage(message, 'en', values)).toBe(
      new IntlMessageFormat(message, 'en').format(values)
    );
    expect(formatMessageTree(icuToMessageTree(message), 'en', values)).toBe(
      rich
    );
  });

  it('passes a tag callback no children for an empty branch', () => {
    const message = '<b>{s, select, yes {} other {fallback}}</b>';
    const values = { s: 'yes', b: (parts: unknown[]) => parts.length };
    expect(formatMessage(message, 'en', values)).toBe(0);
    expect(new IntlMessageFormat(message, 'en').format(values)).toBe(0);
    expect(formatMessageTree([['b', 'tag', '']], 'en', values)).toBe(0);
  });
});

describe('values', () => {
  it.each([
    ['true', true, 'true'],
    ['false', false, 'false'],
    ['a bigint', 12n, '12'],
    ['zero', 0, '0'],
    ['null', null, ''],
    ['undefined', undefined, ''],
  ])('renders %s as text, like a template literal', (_name, x, text) => {
    expect(formatMessageTree(['a ', ['x'], ' b'], 'en', { x })).toBe(
      `a ${text} b`
    );
    expect(formatMessageTree([['x']], 'en', { x })).toBe(text);
  });

  it('formats a Date in a date node, and as String(date) elsewhere', () => {
    const due = new Date(Date.UTC(2026, 0, 15));
    expect(
      formatMessageTree([['d', 'date']], 'en', { d: due }, { timeZone: 'UTC' })
    ).toBe('Jan 15, 2026');
    expect(formatMessageTree(['Due ', ['d']], 'en', { d: due })).toBe(
      `Due ${due}`
    );
  });

  it('keeps rich values and tag results as parts', () => {
    const element = { type: 'strong' };
    expect(formatMessageTree([['x']], 'en', { x: element })).toBe(element);
    expect(
      formatMessageTree(['Hi ', ['x'], '!'], 'en', { x: element })
    ).toEqual(['Hi ', element, '!']);
    expect(
      formatMessageTree(['Read the ', ['b', 'tag', 'terms']], 'en', {
        b: (parts) => ({ type: 'b', parts }),
      })
    ).toEqual(['Read the ', { type: 'b', parts: ['terms'] }]);
  });

  it('flattens the parts a tag formatter returns', () => {
    const element = { type: 'b' };
    // One part: the result is that part, not an array holding it.
    expect(
      formatMessageTree([['b', 'tag', 'hello']], 'en', { b: () => [element] })
    ).toBe(element);
    // A nested tag's parts reach the outer formatter one by one.
    const outer = vi.fn((parts: unknown[]) => parts);
    expect(
      formatMessageTree([['o', 'tag', [['i', 'tag', 'x']]]], 'en', {
        o: outer,
        i: () => [42, 43],
      })
    ).toEqual([42, 43]);
    expect(outer).toHaveBeenCalledWith([42, 43]);
  });

  it('formats ICU strings through formatMessage with the same value rules', () => {
    expect(formatMessage('a {x} b', 'en', { x: true })).toBe('a true b');
    expect(formatMessage('a {x} b', 'en', { x: false })).toBe('a false b');
  });
});
