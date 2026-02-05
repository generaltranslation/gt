import { describe, it, expect } from 'vitest';
import { validateLocales } from '../validateLocales';

describe('validateLocales', () => {
  it('validates invalid locale when GT services enabled', () => {
    const result = validateLocales({
      defaultLocale: 'invalid-locale',
      cacheUrl: undefined, // GT_REMOTE enabled
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('error');
    expect(result[0].message).toContain('Invalid locale: invalid-locale');
  });

  it('validates multiple locales when GT services enabled', () => {
    const result = validateLocales({
      locales: ['en', 'invalid-locale'],
      defaultLocale: 'en',
      runtimeUrl: undefined, // GT enabled
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('error');
    expect(result[0].message).toContain('Invalid locale: invalid-locale');
  });

  it('skips validation when GT services disabled', () => {
    const result = validateLocales({
      defaultLocale: 'invalid-locale',
      cacheUrl: null,
      runtimeUrl: null,
    });
    expect(result).toHaveLength(0);
  });
});
