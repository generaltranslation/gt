import { describe, expect, it } from 'vitest';
import { IntlCache, intlCache } from '../cache/IntlCache';
import { libraryDefaultLocale } from '../settings/settings';

function inHostZones(zones: string[], run: (zone: string) => void): void {
  const hostZone = process.env.TZ;
  try {
    for (const zone of zones) {
      process.env.TZ = zone;
      run(zone);
    }
  } finally {
    if (hostZone === undefined) delete process.env.TZ;
    else process.env.TZ = hostZone;
  }
}

describe('IntlCache', () => {
  it('returns one instance for the same locales and options', () => {
    const percent = intlCache.get('NumberFormat', 'en-BW', {
      style: 'percent',
    });
    expect(intlCache.get('NumberFormat', 'en-BW', { style: 'percent' })).toBe(
      percent
    );
    expect(intlCache.get('NumberFormat', 'en-BW')).not.toBe(percent);
    expect(
      intlCache.get('NumberFormat', 'en-NA', { style: 'percent' })
    ).not.toBe(percent);
  });

  it('uses the library default locale when there are no locales', () => {
    expect(intlCache.get('NumberFormat').resolvedOptions().locale).toBe(
      libraryDefaultLocale
    );
    expect(intlCache.get('NumberFormat')).toBe(
      intlCache.get('NumberFormat', libraryDefaultLocale)
    );
  });

  it('gives a date without a time zone the host zone at the time of use', () => {
    const date = new Date('2020-05-06T14:03:02Z');
    const options = { hour: 'numeric', minute: '2-digit' } as const;
    inHostZones(['UTC', 'America/New_York'], () => {
      const format = intlCache.get('DateTimeFormat', 'en-US', options);
      expect(format.format(date)).toBe(
        new Intl.DateTimeFormat('en-US', options).format(date)
      );
      expect(intlCache.get('DateTimeFormat', 'en-US', options)).toBe(format);
    });
  });

  it('keeps one instance of a date with a time zone when the host zone changes', () => {
    const instances = new Set<Intl.DateTimeFormat>();
    inHostZones(['UTC', 'America/New_York'], () => {
      instances.add(
        intlCache.get('DateTimeFormat', 'en-US', { timeZone: 'Asia/Tokyo' })
      );
    });
    expect(instances.size).toBe(1);
  });

  it('passes own options only, as its key holds', () => {
    const options: Intl.DateTimeFormatOptions = Object.assign(
      Object.create({ timeZone: 'Asia/Tokyo' }),
      { hour: 'numeric' }
    );
    expect(
      intlCache.get('DateTimeFormat', 'en-US', options).resolvedOptions()
        .timeZone
    ).toBe(new Intl.DateTimeFormat('en-US').resolvedOptions().timeZone);
  });

  it('starts over when a constructor has 256 instances', () => {
    class Format {
      constructor(
        readonly locales: string,
        readonly options?: { n: number }
      ) {}
    }
    const cache = new IntlCache({ Format });
    const first = cache.get('Format', 'en', { n: 0 });
    for (let n = 1; n < 256; n++) cache.get('Format', 'en', { n });
    expect(cache.get('Format', 'en', { n: 0 })).toBe(first);
    cache.get('Format', 'en', { n: 256 });
    expect(cache.get('Format', 'en', { n: 0 })).not.toBe(first);
  });

  it('extends with more constructors and shares its instances', () => {
    class Format {
      constructor(
        readonly locales: string,
        readonly options?: { maxChars: number }
      ) {}
    }
    const extended = intlCache.extend({ Format });
    const format = extended.get('Format', 'fr', { maxChars: 3 });
    expect(format).toBeInstanceOf(Format);
    expect(format.options).toEqual({ maxChars: 3 });
    expect(extended.get('Format', 'fr', { maxChars: 3 })).toBe(format);
    expect(extended.get('NumberFormat', 'en-LS')).toBe(
      intlCache.get('NumberFormat', 'en-LS')
    );
  });
});
