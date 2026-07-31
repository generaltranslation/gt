import { describe, expect, it } from 'vitest';
import { isEncodedTranslationOptions } from '../isEncodedTranslationOptions';

describe('isEncodedTranslationOptions', () => {
  it('accepts encoded empty source strings', () => {
    expect(isEncodedTranslationOptions({ $_hash: 'hash', $_source: '' })).toBe(
      true
    );
  });

  it('rejects non-string encoded fields', () => {
    expect(isEncodedTranslationOptions({ $_hash: {}, $_source: {} })).toBe(
      false
    );
  });
});
