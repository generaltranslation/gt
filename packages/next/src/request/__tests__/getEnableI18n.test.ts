import { afterEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { getEnableI18n } from '../getEnableI18n';

describe('getEnableI18n', () => {
  afterEach(() => {
    // Reset the shared config singleton between cases.
    initializeI18nConfig({ defaultLocale: 'en' });
  });

  it('resolves true by default (config omits enableI18n)', async () => {
    initializeI18nConfig({ defaultLocale: 'en' });
    await expect(getEnableI18n()).resolves.toBe(true);
  });

  it('resolves false when config disables i18n', async () => {
    initializeI18nConfig({ defaultLocale: 'en', enableI18n: false });
    await expect(getEnableI18n()).resolves.toBe(false);
  });
});
