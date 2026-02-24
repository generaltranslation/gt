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
    const result = gtFallback(null as unknown as string);
    expect(result).toBeNull();
  });

  it('handles undefined message', () => {
    const result = gtFallback(undefined as unknown as string);
    expect(result).toBeUndefined();
  });

  it('returns array of messages unchanged without options', () => {
    const result = gtFallback(['Hello, world!', 'Goodbye, world!']);
    expect(result).toEqual(['Hello, world!', 'Goodbye, world!']);
  });

  it('interpolates variables in each message of an array', () => {
    const result = gtFallback(['Hello, {name}!', 'Welcome to {place}!'], {
      name: 'Alice',
      place: 'Wonderland',
    });
    expect(result).toEqual(['Hello, Alice!', 'Welcome to Wonderland!']);
  });

  it('handles an empty array', () => {
    const result = gtFallback([]);
    expect(result).toEqual([]);
  });
});
