import { describe, it, expect } from 'vitest';
import { hashSource } from '../hashSource';

describe('hashSource requiresReview', () => {
  it('hashes identically when requiresReview is false or absent (ICU)', () => {
    const base = hashSource({ source: 'Hello world', dataFormat: 'ICU' });
    const explicitFalse = hashSource({
      source: 'Hello world',
      requiresReview: false,
      dataFormat: 'ICU',
    });
    expect(explicitFalse).toBe(base);
  });

  it('hashes identically when requiresReview is false or absent (JSX)', () => {
    const source = ['Hello ', { c: ['world'] }];
    const base = hashSource({ source, dataFormat: 'JSX' });
    const explicitFalse = hashSource({
      source,
      requiresReview: false,
      dataFormat: 'JSX',
    });
    expect(explicitFalse).toBe(base);
  });

  it('produces a different hash when requiresReview is true', () => {
    const base = hashSource({ source: 'Hello world', dataFormat: 'ICU' });
    const reviewed = hashSource({
      source: 'Hello world',
      requiresReview: true,
      dataFormat: 'ICU',
    });
    expect(reviewed).not.toBe(base);
  });

  it('is stable for requiresReview: true', () => {
    const a = hashSource({
      source: 'Hello world',
      requiresReview: true,
      dataFormat: 'ICU',
    });
    const b = hashSource({
      source: 'Hello world',
      requiresReview: true,
      dataFormat: 'ICU',
    });
    expect(a).toBe(b);
  });

  it('composes with other metadata without disturbing their hashes', () => {
    const withContext = hashSource({
      source: 'Hello world',
      context: 'nav',
      dataFormat: 'ICU',
    });
    const withContextAndReview = hashSource({
      source: 'Hello world',
      context: 'nav',
      requiresReview: true,
      dataFormat: 'ICU',
    });
    const withContextAndFalseReview = hashSource({
      source: 'Hello world',
      context: 'nav',
      requiresReview: false,
      dataFormat: 'ICU',
    });
    expect(withContextAndFalseReview).toBe(withContext);
    expect(withContextAndReview).not.toBe(withContext);
  });

  it('does not change legacy hashes (pinned values)', () => {
    // Pinned pre-requiresReview hashes: if these change, every existing
    // project would retranslate on upgrade.
    expect(hashSource({ source: 'Hello world', dataFormat: 'ICU' })).toBe(
      '05a87bce151d258b'
    );
    expect(
      hashSource({ source: ['Hello ', { c: ['world'] }], dataFormat: 'JSX' })
    ).toBe('2ef012fb27e5f019');
  });
});

describe('hashSource id compatibility', () => {
  it('continues to include the deprecated id in the hash', () => {
    const withoutId = hashSource({
      source: 'Hello world',
      dataFormat: 'ICU',
    });
    const withFirstId = hashSource({
      source: 'Hello world',
      id: 'first-id',
      dataFormat: 'ICU',
    });
    const withSecondId = hashSource({
      source: 'Hello world',
      id: 'second-id',
      dataFormat: 'ICU',
    });

    expect(withFirstId).not.toBe(withoutId);
    expect(withSecondId).not.toBe(withFirstId);
    // Existing callers that still pass an ID must keep their current hashes.
    expect(withFirstId).toBe('b654d66386ed785a');
    expect(withSecondId).toBe('8220228ac45bb5ee');
  });
});
