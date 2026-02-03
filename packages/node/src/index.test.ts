import { describe, it, expect } from 'vitest';
import gtNode from './index';

describe('gt-node', () => {
  it('should return hello world', () => {
    expect(gtNode()).toBe('Hello World');
  });
});