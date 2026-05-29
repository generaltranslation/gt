import { describe, expect, it } from 'vitest';
import { getSupportedLocale, listSupportedLocales } from '../index';

describe('@generaltranslation/supported-locales', () => {
  it('lists Esperanto as a supported locale', () => {
    expect(listSupportedLocales()).toContain('eo');
  });

  it('matches Esperanto locale requests to the supported language code', () => {
    expect(getSupportedLocale('eo')).toBe('eo');
    expect(getSupportedLocale('eo-US')).toBe('eo');
  });
});
