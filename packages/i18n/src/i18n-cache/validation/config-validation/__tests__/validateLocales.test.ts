import { describe, it, expect, beforeEach } from 'vitest';
import { setupGTServicesEnabled } from '../../../utils/getGTServicesEnabled';
import { validateLocales } from '../validateLocales';

describe('validateLocales', () => {
  beforeEach(() => {
    setupGTServicesEnabled({});
  });

  it('validates invalid locale when GT services enabled', () => {
    setupGTServicesEnabled({
      projectId: 'test-project',
      cacheUrl: undefined,
    });

    const result = validateLocales({
      defaultLocale: 'invalid-locale',
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('error');
    expect(result[0].message).toContain('Locale "invalid-locale" is not valid');
  });

  it('validates multiple locales when GT services enabled', () => {
    setupGTServicesEnabled({
      projectId: 'test-project',
      runtimeUrl: undefined,
    });

    const result = validateLocales({
      locales: ['en', 'invalid-locale'],
      defaultLocale: 'en',
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('error');
    expect(result[0].message).toContain('Locale "invalid-locale" is not valid');
  });

  it('skips validation when GT services disabled', () => {
    setupGTServicesEnabled({
      cacheUrl: null,
      runtimeUrl: null,
    });

    const result = validateLocales({
      defaultLocale: 'invalid-locale',
    });
    expect(result).toHaveLength(0);
  });
});
