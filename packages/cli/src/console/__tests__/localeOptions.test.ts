import { describe, expect, it } from 'vitest';
import { getFilteredLocaleOptions } from '../localeOptions.js';

describe('locale options', () => {
  it('prioritizes exact locale code matches over substring matches', () => {
    const options = getFilteredLocaleOptions('fr');

    expect(options[0]?.code).toBe('fr');
    expect(options[0]?.name).toBe('French');
  });
});
