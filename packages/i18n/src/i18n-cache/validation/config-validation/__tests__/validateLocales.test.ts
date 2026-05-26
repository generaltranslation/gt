import { describe, it, expect } from 'vitest';
import { validateLocales } from '../validateLocales';

describe('validateLocales', () => {
  it('validates invalid locale when GT services enabled', () => {
    const result = validateLocales({ defaultLocale: 'invalid-locale' }, true);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('error');
    expect(result[0].message).toContain('Locale "invalid-locale" is not valid');
  });

  it('validates multiple locales when GT services enabled', () => {
    const result = validateLocales(
      {
        locales: ['en', 'invalid-locale'],
        defaultLocale: 'en',
      },
      true
    );
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('error');
    expect(result[0].message).toContain('Locale "invalid-locale" is not valid');
  });

  it('skips validation when GT services disabled', () => {
    const result = validateLocales({ defaultLocale: 'invalid-locale' }, false);
    expect(result).toHaveLength(0);
  });
});
