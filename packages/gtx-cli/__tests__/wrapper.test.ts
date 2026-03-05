import { describe, it, expect } from 'vitest';
import { main } from 'gt';

describe('gtx-cli wrapper', () => {
  it('re-exports main from gt', () => {
    expect(typeof main).toBe('function');
  });
});
