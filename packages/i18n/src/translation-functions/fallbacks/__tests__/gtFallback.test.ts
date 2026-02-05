import { describe, it, expect } from 'vitest';
import { gtFallback } from '../gtFallback';

describe('gtFallback', () => {
  it('returns message unchanged without options', () => {
    const result = gtFallback('Hello, world!');
    expect(result).toBe('Hello, world!');
  });

  it('interpolates variables in message', () => {
    const result = gtFallback('Hello, {name}!', { name: 'Alice' });
    expect(result).toBe('Hello, Alice!');
  });

  it('handles null message', () => {
    const result = gtFallback(null);
    expect(result).toBeNull();
  });

  it('handles undefined message', () => {
    const result = gtFallback(undefined);
    expect(result).toBeUndefined();
  });
});
