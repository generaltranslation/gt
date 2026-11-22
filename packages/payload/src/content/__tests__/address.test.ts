// Plain text values that point somewhere stay untranslated.
import { describe, expect, it } from 'vitest';
import { isAddress } from '../content/address';

describe('isAddress', () => {
  it('treats paths, emails and URLs as addresses', () => {
    for (const value of [
      '/contact',
      '#pricing',
      './docs',
      'hi@example.com',
      'https://example.com',
      'mailto:hi@example.com',
      'tel:+15551234',
    ])
      expect(isAddress(value), value).toBe(true);
  });

  it('treats words and sentences as text', () => {
    for (const value of [
      'Contact us',
      'Pricing',
      'a@b',
      '@handle',
      'hi@example.',
      'one@two@three.com',
    ])
      expect(isAddress(value), value).toBe(false);
  });

  it('answers quickly for long values', () => {
    const value = `!@!.${'!.'.repeat(50_000)}@`;
    // Timed because there is nothing to count: the risk is one regular
    // expression call that backtracks. The usual email pattern takes over two
    // seconds on this value; the check here takes well under a millisecond.
    const started = performance.now();
    const result = isAddress(value);

    expect(result).toBe(false);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
