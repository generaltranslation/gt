import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetCookie = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({
    server: (serverFn: unknown) => serverFn,
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(),
  setCookie: (...args: unknown[]) => mockSetCookie(...args),
}));

import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { initializeRequestConditions } from '../../functions/requestConditions';
import { gtMiddleware } from '../gtMiddleware';

type Middleware = (args: {
  request: Request;
  next: () => Promise<unknown>;
}) => Promise<unknown>;

describe('gtMiddleware', () => {
  beforeEach(() => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    initializeRequestConditions();
    mockSetCookie.mockReset();
  });

  it('warms request conditions before continuing', async () => {
    const next = vi.fn(async () => 'result');
    const request = new Request('https://example.com', {
      headers: { cookie: 'generaltranslation.locale=fr' },
    });

    await expect(
      (gtMiddleware as unknown as Middleware)({ request, next })
    ).resolves.toBe('result');
    expect(mockSetCookie).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });
});
