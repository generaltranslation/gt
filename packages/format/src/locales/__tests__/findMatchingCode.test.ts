import { describe, expect, it } from 'vitest';
import { findMatchingCode } from '../determineLocale';

describe('findMatchingCode', () => {
  describe('exact matches', () => {
    it('returns an exact locale match', () => {
      expect(findMatchingCode('en-US', new Set(['en-US']))).toBe('en-US');
    });

    it('returns an exact bare-language match', () => {
      expect(findMatchingCode('pt', new Set(['pt', 'pt-BR']))).toBe('pt');
    });

    it('prefers an exact match over every derived match', () => {
      const candidates = new Set(['zh-Hans', 'zh-HK', 'zh-Hans-HK']);

      expect(findMatchingCode('zh-Hans-HK', candidates)).toBe('zh-Hans-HK');
    });

    it('preserves an exact variant match', () => {
      expect(findMatchingCode('sl-rozaj', new Set(['sl-rozaj']))).toBe(
        'sl-rozaj'
      );
    });
  });

  describe('derived matches', () => {
    it('matches a language-region candidate', () => {
      expect(findMatchingCode('zh-Hans-HK', new Set(['zh-HK']))).toBe('zh-HK');
    });

    it('matches a language-script candidate', () => {
      expect(findMatchingCode('zh-Hant-TW', new Set(['zh-Hant']))).toBe(
        'zh-Hant'
      );
    });

    it('infers a missing region from a script-only locale', () => {
      expect(findMatchingCode('zh-Hant', new Set(['zh-TW']))).toBe('zh-TW');
    });

    it('infers a missing script from a region-only locale', () => {
      expect(findMatchingCode('zh-TW', new Set(['zh-Hant']))).toBe('zh-Hant');
    });

    it('supports numeric region subtags', () => {
      expect(findMatchingCode('es-Latn-419', new Set(['es-419']))).toBe(
        'es-419'
      );
    });

    it('uses a likely region when the input is a bare language', () => {
      expect(findMatchingCode('pt', new Set(['pt-BR']))).toBe('pt-BR');
    });

    it('uses a likely script when the input is a bare language', () => {
      expect(findMatchingCode('sr', new Set(['sr-Cyrl']))).toBe('sr-Cyrl');
    });

    it('falls back to the minimized locale', () => {
      expect(findMatchingCode('en-Latn-US', new Set(['en']))).toBe('en');
    });

    it('preserves Unicode extensions in the minimized locale', () => {
      expect(
        findMatchingCode(
          'en-Latn-US-u-ca-buddhist',
          new Set(['en-u-ca-buddhist'])
        )
      ).toBe('en-u-ca-buddhist');
    });

    it('derives matches from a locale containing a variant', () => {
      expect(findMatchingCode('sl-Latn-SI-rozaj', new Set(['sl-SI']))).toBe(
        'sl-SI'
      );
    });
  });

  describe('precedence', () => {
    it('prefers a region match over a script match', () => {
      const candidates = new Set(['zh-Hans', 'zh-HK']);

      expect(findMatchingCode('zh-Hans-HK', candidates)).toBe('zh-HK');
    });

    it('prefers a script match over a minimized match', () => {
      const candidates = new Set(['en-u-ca-buddhist', 'en-Latn']);

      expect(findMatchingCode('en-Latn-US-u-ca-buddhist', candidates)).toBe(
        'en-Latn'
      );
    });

    it('prefers a likely region over a likely script', () => {
      const candidates = new Set(['sr-Cyrl', 'sr-RS']);

      expect(findMatchingCode('sr', candidates)).toBe('sr-RS');
    });

    it('does not depend on candidate insertion order', () => {
      const regionFirst = new Set(['zh-HK', 'zh-Hans']);
      const scriptFirst = new Set(['zh-Hans', 'zh-HK']);

      expect(findMatchingCode('zh-Hans-HK', regionFirst)).toBe('zh-HK');
      expect(findMatchingCode('zh-Hans-HK', scriptFirst)).toBe('zh-HK');
    });
  });

  describe('no match', () => {
    it('returns undefined for an empty candidate set', () => {
      expect(findMatchingCode('en-US', new Set())).toBeUndefined();
    });

    it('does not select an arbitrary dialect of the same language', () => {
      expect(findMatchingCode('en-AU', new Set(['en-GB']))).toBeUndefined();
    });

    it('does not use prefix or partial matches', () => {
      expect(
        findMatchingCode('en-US', new Set(['en-U', 'en-US-extra']))
      ).toBeUndefined();
    });

    it('does not match an unrelated language', () => {
      expect(findMatchingCode('en-US', new Set(['fr-FR']))).toBeUndefined();
    });
  });
});
