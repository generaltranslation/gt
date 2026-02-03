import { describe, it, expect } from 'vitest';
import { helloWorld } from '../index';

describe('gt-node', () => {
  it('should return hello world', () => {
    expect(helloWorld()).toBe('Hello World');
  });
});
