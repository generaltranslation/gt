import { describe, expect, it } from 'vitest';
import { getCookieValue, parseAcceptLanguage } from '../request';

describe('parseAcceptLanguage', () => {
  it('sorts locale candidates by quality', () => {
    expect(parseAcceptLanguage('es;q=0.5, fr;q=0.9, en')).toEqual([
      'en',
      'fr',
      'es',
    ]);
  });

  it('supports multiple header values', () => {
    expect(parseAcceptLanguage(['es;q=0.5', 'fr;q=0.9'])).toEqual(['fr', 'es']);
  });

  it('preserves header order for equal quality values', () => {
    expect(parseAcceptLanguage('fr, es;q=1, en')).toEqual(['fr', 'es', 'en']);
  });

  it('finds the quality value among other parameters', () => {
    expect(parseAcceptLanguage('es;foo=bar;q=0.5, fr;q=0.9')).toEqual([
      'fr',
      'es',
    ]);
  });

  it('omits wildcards and unacceptable or invalid candidates', () => {
    expect(parseAcceptLanguage('*, en;q=0, es;q=invalid, fr;q=2')).toEqual([]);
  });
});

describe('getCookieValue', () => {
  it('reads an exact cookie name without requiring spaces', () => {
    expect(
      getCookieValue('other=value;locale=fr;locale-extra=es', 'locale')
    ).toBe('fr');
  });

  it('decodes cookie values and preserves equals signs', () => {
    expect(getCookieValue('locale=brand%2Dfrench%3Dca', 'locale')).toBe(
      'brand-french=ca'
    );
  });

  it('returns undefined when the cookie is absent', () => {
    expect(getCookieValue('other=value', 'locale')).toBeUndefined();
  });
});
