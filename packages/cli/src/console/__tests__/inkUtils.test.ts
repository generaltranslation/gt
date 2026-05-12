import { describe, expect, it } from 'vitest';
import { truncate } from '../inkUtils.js';

describe('ink utils', () => {
  it('truncates without exceeding the requested width', () => {
    expect(truncate('abcdef', 6)).toBe('abcdef');
    expect(truncate('abcdef', 5)).toBe('ab...');
    expect(truncate('abcdef', 3)).toBe('...');
    expect(truncate('abcdef', 1)).toBe('a');
  });
});
