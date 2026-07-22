import { describe, expect, it } from 'vitest';
import { getContentWidth, limitLines, truncate } from '../inkUtils.js';

describe('ink utils', () => {
  it('truncates without exceeding the requested width', () => {
    expect(truncate('abcdef', 6)).toBe('abcdef');
    expect(truncate('abcdef', 5)).toBe('ab...');
    expect(truncate('abcdef', 3)).toBe('...');
    expect(truncate('abcdef', 1)).toBe('a');
  });

  it('keeps content width inside very narrow terminals', () => {
    expect(getContentWidth(12)).toBe(12);
    expect(getContentWidth(80)).toBe(76);
  });

  it('limits wrapped message lines with an ellipsis', () => {
    expect(limitLines(['one', 'two', 'three'], 2, 5)).toEqual(['one', 'tw...']);
  });
});
