import { describe, it, expect } from 'vitest';
import { validateLocales } from '../validateLocales';
import { setupGTServicesEnabled } from '../../../../globals/getGTServicesEnabled';

describe('validateLocales', () => {
  it('validates invalid locale when GT services enabled', () => {
    setupGTServicesEnabled({
      projectId: 'test-project',
      cacheUrl: undefined, // GT_REMOTE enabled
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
      devApiKey: 'test-key',
      runtimeUrl: undefined, // GT enabled
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
