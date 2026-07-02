import { describe, expect, it } from 'vitest';
import { parseAcceptLanguage } from '../utils';

describe('parseAcceptLanguage', () => {
  it('returns an empty array for a missing header', () => {
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage('')).toEqual([]);
  });

  it('parses locales ordered by quality', () => {
    expect(parseAcceptLanguage('en;q=0.8,fr-FR,fr;q=0.9')).toEqual([
      'fr-FR',
      'fr',
      'en',
    ]);
  });

  it('defaults missing q-values to 1', () => {
    expect(parseAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.8')).toEqual([
      'fr-FR',
      'fr',
      'en',
    ]);
  });

  it('drops wildcard entries', () => {
    expect(parseAcceptLanguage('*,fr;q=0.5')).toEqual(['fr']);
  });

  it('tolerates malformed q-values', () => {
    expect(parseAcceptLanguage('fr;q=abc,en;q=0.5')).toEqual(['fr', 'en']);
  });
});
