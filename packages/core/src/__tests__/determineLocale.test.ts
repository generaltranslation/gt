import { describe, expect, it } from 'vitest';
import { GTRuntime } from '../runtime';

describe('GTRuntime.determineLocale approved identifiers', () => {
  it('preserves explicit approved spelling with configured and per-call mappings', () => {
    const gt = new GTRuntime({ locales: ['en-us', 'fr'] });
    // Constructor locales are canonicalized; explicit approved lists retain spelling.
    expect(gt.determineLocale('en-US')).toBe('en-US');
    expect(gt.determineLocale('en-US', ['en-us'])).toBe('en-us');
    expect(gt.determineLocale('en-US', ['en-us'], {})).toBe('en-us');
  });

  it('resolves per-call aliases back to the approved identifier', () => {
    const gt = new GTRuntime();
    expect(
      gt.determineLocale('en-GB', ['brand'], { brand: { code: 'en-gb' } })
    ).toBe('brand');
    expect(
      gt.determineLocale('de', ['brand'], { brand: { code: 'en-gb' } })
    ).toBeUndefined();
  });
});
