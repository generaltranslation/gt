import { describe, expect, it } from 'vitest';
import { getSupportedLocale, listSupportedLocales } from '../index';

describe('@generaltranslation/supported-locales', () => {
  it('lists Toki Pona as a supported locale', () => {
    expect(listSupportedLocales()).toContain('tok');
  });

  it('matches Toki Pona locale requests to the supported language code', () => {
    expect(getSupportedLocale('tok')).toBe('tok');
    expect(getSupportedLocale('tok-US')).toBe('tok');
    expect(getSupportedLocale('tok-Latn')).toBe('tok');
  });
});
