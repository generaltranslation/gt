import { describe, expect, it } from 'vitest';
import { GTRuntime } from '../runtime';

describe('GTRuntime.determineLocale approved identifiers', () => {
  it.each([
    ['sh', 'sr-Latn'],
    ['cnr', 'sr-ME'],
  ])('preserves accepted legacy code %s', (locale, canonical) => {
    const gt = new GTRuntime({ sourceLocale: locale, locales: [locale] });
    expect(gt.sourceLocale).toBe(locale);
    expect(gt.determineLocale(locale)).toBe(locale);
    expect(gt.determineLocale(canonical)).toBe(locale);
  });
  it('preserves explicit approved spelling with configured and per-call mappings', () => {
    const gt = new GTRuntime({ locales: ['en-us', 'fr'] });
    // Constructor locales and explicit approved lists retain configured spelling.
    expect(gt.determineLocale('en-US')).toBe('en-us');
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
