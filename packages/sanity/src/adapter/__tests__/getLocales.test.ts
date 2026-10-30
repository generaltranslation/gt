import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { pluginConfig } from '../core';
import { getLocales } from '../getLocales';

beforeEach(() => {
  vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
  // Feature tests run with the option on; flag-off tests turn it off.
  vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
    true
  );
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

describe('getLocales without allowNonDefaultSourceLocales', () => {
  beforeEach(() => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      false
    );
  });

  test('offers only the configured targets, whatever the document language', async () => {
    expect(await localeIds()).toEqual(['fr', 'de']);
    expect(await localeIds('en')).toEqual(['fr', 'de']);
    expect(await localeIds('fr')).toEqual(['fr', 'de']);
  });
});
