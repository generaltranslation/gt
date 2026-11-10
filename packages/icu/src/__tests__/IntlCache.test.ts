import { describe, expect, it } from 'vitest';
import { IntlCache, intlCache } from '../cache/IntlCache';
import { libraryDefaultLocale } from '../settings/settings';

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

  it('returns one instance for the same options in another order', () => {
    expect(
      intlCache.get('NumberFormat', 'en-BW', {
        style: 'currency',
        currency: 'EUR',
      })
    ).toBe(
      intlCache.get('NumberFormat', 'en-BW', {
        currency: 'EUR',
        style: 'currency',
      })
    );
    expect(
      intlCache.get('NumberFormat', 'en-BW', {
        style: 'currency',
        currency: 'USD',
      })
    ).not.toBe(
      intlCache.get('NumberFormat', 'en-BW', {
        currency: 'EUR',
        style: 'currency',
      })
    );
  });

  it('uses the library default locale when there are no locales', () => {
    expect(intlCache.get('NumberFormat').resolvedOptions().locale).toBe(
      libraryDefaultLocale
    );
    expect(intlCache.get('NumberFormat')).toBe(
      intlCache.get('NumberFormat', libraryDefaultLocale)
    );
  });

  it('passes own options only, as its key holds', () => {
    const options = Object.assign(Object.create({ hour12: false }), {
      hour: 'numeric',
      timeZone: 'UTC',
    });
    expect(
      intlCache.get('DateTimeFormat', 'en-US', options).resolvedOptions().hour12
    ).toBe(true);
  });

  it('keeps a `__proto__` key from JSON out of the options Intl reads', () => {
    for (const json of [
      '{"__proto__":{"minimumFractionDigits":2}}',
      '{"__proto__":{"minimumFractionDigits":2},"useGrouping":true}',
    ]) {
      expect(
        intlCache.get('NumberFormat', 'en-NZ', JSON.parse(json)).format(1)
      ).toBe('1');
    }
    // A formatter built with such options is not shared with ordinary ones.
    expect(intlCache.get('NumberFormat', 'en-NZ').format(1)).toBe('1');
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

  it('keeps apart two constructors that extend it under one name', () => {
    // Two copies of a package, each with its own class, on one copy of icu.
    class First {
      constructor(readonly locales: string) {}
    }
    class Second {
      constructor(readonly locales: string) {}
    }
    const first = intlCache.extend({ Format: First });
    const second = intlCache.extend({ Format: Second });
    expect(first.get('Format', 'en')).toBeInstanceOf(First);
    expect(second.get('Format', 'en')).toBeInstanceOf(Second);
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
