import { describe, expect, it } from 'vitest';

import { ASPECT_16_9, aspectOf } from '../types';

describe('aspectOf', () => {
  it("resolves '16:9' to the shared ratio constant", () => {
    expect(aspectOf('16:9')).toBe(ASPECT_16_9);
    expect(aspectOf('16:9')).toBeCloseTo(1.778, 3);
  });

  it('resolves a custom { aspect } to its numeric ratio', () => {
    expect(aspectOf({ aspect: 4 / 3 })).toBeCloseTo(1.333, 3);
  });

  it("returns null for 'none', undefined, and non-positive aspects", () => {
    expect(aspectOf('none')).toBeNull();
    expect(aspectOf(undefined)).toBeNull();
    expect(aspectOf({ aspect: 0 })).toBeNull();
    expect(aspectOf({ aspect: -2 })).toBeNull();
  });
});
