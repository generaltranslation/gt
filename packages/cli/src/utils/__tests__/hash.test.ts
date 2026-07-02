import { describe, it, expect } from 'vitest';
import { hashStringSync, hashVersionId } from '../hash.js';

describe('hashVersionId', () => {
  it('equals the plain content hash when requiresReview is false', () => {
    expect(hashVersionId('{"a":1}', false)).toBe(hashStringSync('{"a":1}'));
  });

  it('differs from the plain content hash when requiresReview is true', () => {
    expect(hashVersionId('{"a":1}', true)).not.toBe(hashStringSync('{"a":1}'));
  });

  it('is stable for the same inputs', () => {
    expect(hashVersionId('{"a":1}', true)).toBe(hashVersionId('{"a":1}', true));
  });

  it('still reflects content changes when requiresReview is true', () => {
    expect(hashVersionId('{"a":1}', true)).not.toBe(
      hashVersionId('{"a":2}', true)
    );
  });
});
