import { describe, it, expect } from 'vitest';
import { _determineLocale, type MatchLocale } from '../determineLocale';

const matchLocale = (tag: string, script = ''): MatchLocale => ({
  tag,
  language: tag.split('-')[0],
  script,
});

const tags = (...values: string[]) => values.map((tag) => matchLocale(tag));

describe('_determineLocale', () => {
  it.each([
    ['zh-Hant-CN-x-private1-private2', 'zh-Hant-CN-x-private1'],
    ['zh-Hant-CN-x-private1', 'zh-Hant-CN'],
    ['zh-Hant-CN', 'zh-Hant'],
    ['zh-Hant', 'zh'],
  ])('lookup truncates %s to %s', (requested, available) => {
    expect(
      _determineLocale(tags(requested), tags(available), 'lookup')?.available
        .tag
    ).toBe(available);
  });

  it('removes a single-character subtag together with its trailing subtag', () => {
    expect(
      _determineLocale(
        tags('zh-Hant-CN-x-private1'),
        tags('zh-Hant-CN-x'),
        'lookup'
      )
    ).toBeUndefined();
  });

  it('tries every truncation of a range before the next range', () => {
    expect(
      _determineLocale(tags('en-GB', 'fr'), tags('fr', 'en'), 'lookup')
        ?.available.tag
    ).toBe('en');
  });

  it('matches tags without a derivable script as empty scripts in best fit', () => {
    expect(
      _determineLocale(tags('qaa-QM'), tags('qaa-QN'), 'best fit')?.available
        .tag
    ).toBe('qaa-QN');
    expect(
      _determineLocale(tags('qaa-QM'), tags('qaa-QN'), 'lookup')
    ).toBeUndefined();
  });

  it('reports the requested record that produced the match', () => {
    const requested = tags('de', 'fr-CA-x-test');
    const available = tags('fr-CA');
    const match = _determineLocale(requested, available, 'lookup');
    expect(match?.requested).toBe(requested[1]);
    expect(match?.available).toBe(available[0]);
  });
});
