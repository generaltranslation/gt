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

const localeIds = async (sourceLanguage?: string) =>
  (await getLocales(null, sourceLanguage)).map((locale) => locale.localeId);

describe('getLocales', () => {
  test('offers only the configured targets by default', async () => {
    expect(await localeIds()).toEqual(['fr', 'de']);
  });

  test('offers only the configured targets for a source-locale original', async () => {
    expect(await localeIds('en')).toEqual(['fr', 'de']);
  });

  test('also offers the source locale for an original in another locale', async () => {
    expect(await localeIds('fr')).toEqual(['en', 'fr', 'de']);
  });
});
