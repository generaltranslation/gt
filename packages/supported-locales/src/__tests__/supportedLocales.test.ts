import { isValidLocale } from 'generaltranslation';
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

  it.each(listSupportedLocales())(
    'accepts listed locale %s and resolves it to a listed locale',
    (locale) => {
      expect(isValidLocale(locale)).toBe(true);
      expect(listSupportedLocales()).toContain(getSupportedLocale(locale));
    }
  );

  it('maps the former el-EL listing to el-GR', () => {
    expect(listSupportedLocales()).not.toContain('el-EL');
    expect(getSupportedLocale('el-EL')).toBe('el-GR');
  });

  it('supports Mexican English', () => {
    expect(listSupportedLocales()).toContain('en-MX');
    expect(getSupportedLocale('en-MX')).toBe('en-MX');
    expect(getSupportedLocale('en-Latn-MX')).toBe('en-MX');
  });
});
