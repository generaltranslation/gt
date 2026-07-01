import { describe, expect, it } from 'vitest';
import { parseAcceptLanguage } from '../parseAcceptLanguage';

describe('parseAcceptLanguage', () => {
  it('preserves order when no q-values are present', () => {
    expect(parseAcceptLanguage('fr-FR,fr,en')).toEqual(['fr-FR', 'fr', 'en']);
  });

  it('sorts by descending q-value', () => {
    expect(parseAcceptLanguage('en;q=0.5, fr;q=0.9')).toEqual(['fr', 'en']);
  });

  it('treats a missing q-value as quality 1', () => {
    expect(parseAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.8')).toEqual([
      'fr-FR',
      'fr',
      'en',
    ]);
  });

  it('keeps original order for entries with equal quality (stable sort)', () => {
    expect(parseAcceptLanguage('de;q=0.8,fr;q=0.8,en;q=0.8')).toEqual([
      'de',
      'fr',
      'en',
    ]);
  });

  it('drops empty entries', () => {
    expect(parseAcceptLanguage('en,,fr')).toEqual(['en', 'fr']);
  });

  it('drops entries with q=0', () => {
    expect(parseAcceptLanguage('fr;q=0,en;q=0.8')).toEqual(['en']);
  });

  it('falls back to quality 1 for malformed q-values', () => {
    expect(parseAcceptLanguage('en;q=abc,fr;q=0.5')).toEqual(['en', 'fr']);
  });
});
