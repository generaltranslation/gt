import { describe, it, expect } from 'vitest';
import { mFallback } from '../mFallback';

describe('mFallback', () => {
  it('returns decoded message without interpolation', () => {
    const result = mFallback('Hello, world!');
    expect(result).toBe('Hello, world!');
  });

  it('interpolates variables in message', () => {
    const result = mFallback('Hello, {name}!', { name: 'Bob' });
    expect(result).toBe('Hello, Bob!');
  });

  it('handles null message', () => {
    const result = mFallback(null);
    expect(result).toBeNull();
  });

  it('handles undefined message', () => {
    const result = mFallback(undefined);
    expect(result).toBeUndefined();
  });
});