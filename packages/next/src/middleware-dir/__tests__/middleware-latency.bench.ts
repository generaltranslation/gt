// @vitest-environment edge-runtime
import { bench, describe } from 'vitest';
import { vi } from 'vitest';
import type { NextResponse } from 'next/server';
import { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';

// Mock NextResponse (same pattern as Layer 1 tests)
vi.mock('next/server', async (importActual) => {
  const Actual = (await importActual()) as any;
  function createResponse(init: any) {
    const response = new Response(null, init);
    (response as any).cookies = new RequestCookies(
      init?.request?.headers || new Headers()
    );
    return response as NextResponse;
  }
  return {
    ...Actual,
    NextResponse: {
      next: vi.fn((init?: any) => createResponse(init)),
      rewrite: vi.fn((dest: any, init?: any) => createResponse(init)),
      redirect: vi.fn((url: any, init?: any) => createResponse(init)),
    },
  };
});

// Set up env before importing middleware
process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
  defaultLocale: 'en',
  locales: ['en', 'fr', 'es'],
});

import { NextRequest } from 'next/server';

function createRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, 'http://localhost:3000'), {
    headers: new Headers({ 'accept-language': 'en' }),
  });
}

describe('middleware: factory creation latency', () => {
  bench('createNextMiddleware()', async () => {
    const { createNextMiddleware } = await import('gt-next/middleware');
    createNextMiddleware();
  });
});

describe('middleware: per-request execution latency', () => {
  bench('default locale request (/)', async () => {
    const { createNextMiddleware } = await import('gt-next/middleware');
    const middleware = createNextMiddleware();
    middleware(createRequest('/'));
  });

  bench('non-default locale request (/fr)', async () => {
    const { createNextMiddleware } = await import('gt-next/middleware');
    const middleware = createNextMiddleware();
    middleware(createRequest('/fr'));
  });

  bench('nested route (/fr/about)', async () => {
    const { createNextMiddleware } = await import('gt-next/middleware');
    const middleware = createNextMiddleware();
    middleware(createRequest('/fr/about'));
  });
});
