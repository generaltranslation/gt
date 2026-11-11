import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatCutoff,
  formatDateTime,
  formatList,
  formatListToParts,
  formatMessage,
  formatNum,
  formatRelativeTime,
  formatRelativeTimeFromDate,
  LocaleConfig,
} from '../index';
import { formatMessageTree, libraryDefaultLocale } from '../internal';
import { hostTimeZone } from '../utils/hostTimeZone';

const date = new Date('2020-05-06T14:03:02Z');

describe('the time zone of dates and times', () => {
  it('is the one given', () => {
    expect(
      formatDateTime(date, {
        locales: 'en-US',
        timeStyle: 'short',
        timeZone: 'America/New_York',
      })
    ).toBe('10:03 AM');
    expect(
      formatMessage('{at, time, short}', {
        locales: 'en-US',
        variables: { at: date },
        timeZone: 'Asia/Tokyo',
      })
    ).toBe('11:03 PM');
    expect(
      new LocaleConfig({ timeZone: 'Asia/Tokyo' }).formatDateTime(
        date,
        'en-US',
        { timeStyle: 'short' }
      )
    ).toBe('11:03 PM');
  });

  it("is the host's when none is given", () => {
    const expected = new Intl.DateTimeFormat('en-US', {
      timeStyle: 'short',
    }).format(date);
    expect(formatDateTime(date, { locales: 'en-US', timeStyle: 'short' })).toBe(
      expected
    );
    expect(
      formatMessage('{at, time, short}', {
        locales: 'en-US',
        variables: { at: date },
      })
    ).toBe(expected);
    expect(new LocaleConfig().timeZone).toBe(hostTimeZone());
  });

  it("reads the host's time zone once", () => {
    const envZone = process.env.TZ;
    const zone = hostTimeZone();
    expect(zone).toBe(new Intl.DateTimeFormat().resolvedOptions().timeZone);
    try {
      process.env.TZ = zone === 'Asia/Tokyo' ? 'UTC' : 'Asia/Tokyo';
      expect(hostTimeZone()).toBe(zone);
    } finally {
      if (envZone === undefined) delete process.env.TZ;
      else process.env.TZ = envZone;
    }
  });
});

// `@generaltranslation/format` takes every argument; these resolve the rest.
describe('what a caller leaves out', () => {
  it('formats in the library default locale', () => {
    expect(formatNum(1234.5)).toBe('1,234.5');
    expect(formatCurrency(5, 'EUR')).toBe('€5.00');
    expect(formatList(['a', 'b'])).toBe('a and b');
    expect(formatListToParts([1, 2])).toEqual([1, ' and ', 2]);
    expect(formatRelativeTime(-1, 'day')).toBe('yesterday');
    expect(formatCutoff('Hello, world!', { maxChars: 8 })).toBe('Hello, …');
    expect(new LocaleConfig().defaultLocale).toBe(libraryDefaultLocale);
    expect(new LocaleConfig().locales).toEqual([]);
  });

  it('formats in the locales given', () => {
    expect(formatNum(1234.5, { locales: 'de' })).toBe('1.234,5');
    expect(
      formatCutoff('Bonjour, monde !', { locales: 'fr', maxChars: 9 })
    ).toBe('Bonjour\u202f…');
  });

  it('formats a message without variables', () => {
    expect(formatMessage('Hi')).toBe('Hi');
    expect(formatMessage('Hi {name}', { variables: { name: 'Ada' } })).toBe(
      'Hi Ada'
    );
  });

  it('formats a message tree', () => {
    expect(formatMessageTree([['n', 'number']], undefined, { n: 1234.5 })).toBe(
      '1,234.5'
    );
    const at = [['at', 'time', 'short']] as const;
    expect(
      formatMessageTree(
        [...at],
        'en-US',
        { at: date },
        { timeZone: 'Asia/Tokyo' }
      )
    ).toBe('11:03 PM');
    expect(formatMessageTree([...at], 'en-US', { at: date })).toBe(
      new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(date)
    );
  });

  it('formats relative time from a locale config without a base date', () => {
    const hour = 60 * 60 * 1000;
    expect(
      new LocaleConfig().formatRelativeTimeFromDate(new Date(Date.now() - hour))
    ).toBe('1 hour ago');
    expect(
      new LocaleConfig().formatRelativeTimeFromDate(new Date(3 * hour), 'en', {
        baseDate: new Date(0),
      })
    ).toBe('in 3 hours');
  });

  it('compares a date with now, or with the base date', () => {
    const hour = 60 * 60 * 1000;
    expect(formatRelativeTimeFromDate(new Date(Date.now() - hour))).toBe(
      '1 hour ago'
    );
    expect(
      formatRelativeTimeFromDate(new Date(3 * hour), { baseDate: new Date(0) })
    ).toBe('in 3 hours');
  });
});
