import { describe, expect, it } from 'vitest';
import { GT, LocaleConfig } from '../index';

// LocaleConfig.getRegionProperties replaces GTRuntime.getRegionProperties for
// client code that should not bundle the runtime API client; keep them equal.
describe('getRegionProperties parity', () => {
  const customMapping = {
    brand: {
      code: 'fr-CA',
      regionCode: 'CA',
      regionName: 'Brand Canada',
      emoji: '🍁',
    },
  };
  const cases: Array<[string, string]> = [
    ['US', 'en'],
    ['US', 'fr'],
    ['DE', 'ja'],
    ['CA', 'en'],
    ['CA', 'fr'],
  ];

  it.each(cases)('matches GT for region %s in %s', (region, targetLocale) => {
    const gt = new GT({
      sourceLocale: 'en',
      targetLocale,
      locales: ['en', 'fr', 'ja', 'brand'],
      customMapping,
    });
    const localeConfig = new LocaleConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'ja', 'brand'],
      customMapping,
    });
    expect(localeConfig.getRegionProperties(region, targetLocale)).toEqual(
      gt.getRegionProperties(region)
    );
  });
});
