import { describe, expect, it } from 'vitest';
import { calculateTimeoutMs } from '../calculateTimeoutMs.js';

describe('calculateTimeoutMs', () => {
  it('converts seconds to milliseconds', () => {
    expect(calculateTimeoutMs(300)).toBe(300_000);
  });

  it('falls back to the default when undefined', () => {
    expect(calculateTimeoutMs(undefined)).toBe(900_000);
  });

  it('falls back to the default when not a number', () => {
    expect(calculateTimeoutMs('abc')).toBe(900_000);
  });

  it('keeps Infinity so the timeout stays disabled', () => {
    expect(calculateTimeoutMs(Infinity)).toBe(Infinity);
  });
});
