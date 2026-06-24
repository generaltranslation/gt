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

  it('supports Omani Arabic', () => {
    expect(listSupportedLocales()).toContain('ar-OM');
    expect(getSupportedLocale('ar-OM')).toBe('ar-OM');
    expect(getSupportedLocale('ar-Arab-OM')).toBe('ar-OM');
  });
});
