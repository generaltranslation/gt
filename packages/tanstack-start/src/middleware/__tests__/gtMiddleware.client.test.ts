import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({
    server: (serverFn: unknown) => serverFn,
  }),
}));

import { gtMiddleware } from '../gtMiddleware.client';

describe('browser gtMiddleware', () => {
  it('passes through without initializing GT', async () => {
    const next = vi.fn(async () => 'next');

    await expect(
      (
        gtMiddleware as unknown as (args: {
          next: () => Promise<unknown>;
        }) => Promise<unknown>
      )({ next })
    ).resolves.toBe('next');
    expect(next).toHaveBeenCalledOnce();
  });
});
