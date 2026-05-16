import { describe, expect, it } from 'vitest';
import { getTranslationsState } from '../useLoadTranslations';

describe('getTranslationsState', () => {
  it('preserves server-provided translations when loading is disabled', () => {
    const translations = {
      hello: 'Bonjour',
    };

    expect(
      getTranslationsState({
        _translations: translations,
        translationRequired: true,
        loadTranslationsType: 'disabled',
      })
    ).toBe(translations);
  });

  it('requests a load when translations are required and no translations are provided', () => {
    expect(
      getTranslationsState({
        _translations: null,
        translationRequired: true,
        loadTranslationsType: 'default',
      })
    ).toBeNull();
  });

  it('uses an empty translation map when no loading is needed', () => {
    expect(
      getTranslationsState({
        _translations: null,
        translationRequired: false,
        loadTranslationsType: 'disabled',
      })
    ).toEqual({});
  });
});
