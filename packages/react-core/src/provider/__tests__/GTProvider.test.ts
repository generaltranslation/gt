import { describe, expect, it } from 'vitest';
import { getTranslationRequirements } from '../GTProvider';

describe('getTranslationRequirements', () => {
  it('uses server-provided translation requirements when available', () => {
    expect(
      getTranslationRequirements({
        translationRequiredOverride: false,
        dialectTranslationRequiredOverride: false,
        localeTranslationRequired: true,
        localeDialectTranslationRequired: true,
      })
    ).toEqual({
      translationRequired: false,
      dialectTranslationRequired: false,
    });
  });

  it('falls back to locale-derived translation requirements', () => {
    expect(
      getTranslationRequirements({
        localeTranslationRequired: true,
        localeDialectTranslationRequired: true,
      })
    ).toEqual({
      translationRequired: true,
      dialectTranslationRequired: true,
    });
  });
});
