import { describe, expect, it } from 'vitest';
import { formatDateTime, formatMessage, LocaleConfig } from '../index';
import { hostTimeZone } from '../internal';

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
