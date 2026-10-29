import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { pluginConfig } from '../core';
import { getLocales } from '../getLocales';

beforeEach(() => {
  vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
  vi.spyOn(pluginConfig, 'getLocales').mockReturnValue(['fr', 'de']);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const localeIds = async () =>
  (await getLocales(null)).map((locale) => locale.localeId);

describe('getLocales', () => {
  test('offers only the configured targets by default', async () => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      false
    );
    expect(await localeIds()).toEqual(['fr', 'de']);
  });

  test('also offers the source locale when non-default originals are allowed', async () => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      true
    );
    expect(await localeIds()).toEqual(['en', 'fr', 'de']);
  });
});
