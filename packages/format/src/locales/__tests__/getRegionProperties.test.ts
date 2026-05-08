import { describe, expect, it } from 'vitest';

import { getRegionProperties } from '../../core';
import type { CustomRegionMapping } from '../../types';

describe('getRegionProperties', () => {
  it('returns localized properties for ISO alpha-2 regions', () => {
    expect(getRegionProperties('US')).toEqual({
      code: 'US',
      name: 'United States',
      emoji: '🇺🇸',
    });
  });

  it('uses the requested display locale for region names', () => {
    expect(getRegionProperties('US', 'fr')).toEqual({
      code: 'US',
      name: 'États-Unis',
      emoji: '🇺🇸',
    });
  });

  it('returns properties for supported UN M.49 regions', () => {
    expect(getRegionProperties('419')).toEqual({
      code: '419',
      name: 'Latin America',
      emoji: '🌎',
    });
  });

  it('falls back for unknown regions', () => {
    expect(getRegionProperties('ZZ')).toEqual({
      code: 'ZZ',
      name: 'Unknown Region',
      emoji: '🌍',
    });
  });

  it('falls back when the display locale is invalid', () => {
    expect(getRegionProperties('US', 'not a locale')).toEqual({
      code: 'US',
      name: 'US',
      emoji: '🌍',
    });
  });

  it('uses custom mapping overrides', () => {
    const customMapping: CustomRegionMapping = {
      US: {
        name: 'USA',
        emoji: '🗽',
        locale: 'en-US',
      },
    };

    expect(getRegionProperties('US', 'en', customMapping)).toEqual({
      code: 'US',
      name: 'USA',
      emoji: '🗽',
      locale: 'en-US',
    });
  });

  it('uses partial custom mapping overrides', () => {
    expect(
      getRegionProperties('US', 'en', {
        US: {
          name: 'United States of Tests',
        },
      })
    ).toEqual({
      code: 'US',
      name: 'United States of Tests',
      emoji: '🇺🇸',
    });
  });
});
