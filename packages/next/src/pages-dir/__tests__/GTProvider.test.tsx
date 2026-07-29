import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPush, mockReactGTProvider, mockRouter } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReactGTProvider: vi.fn(),
  mockRouter: {
    asPath: '/products/shoes?sort=price#reviews',
    pathname: '/products/[slug]',
    push: vi.fn(),
  },
}));

mockRouter.push = mockPush;

vi.mock('next/router', () => ({ default: mockRouter }));

vi.mock('gt-react', () => ({
  GTProvider: (props: { children?: React.ReactNode }) => {
    mockReactGTProvider(props);
    return props.children;
  },
}));

import { getNextLocaleCookieOptions, GTProvider } from '../GTProvider';

describe('Pages Router GTProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockResolvedValue(true);
    mockRouter.pathname = '/products/[slug]';
    mockRouter.asPath = '/products/shoes?sort=price#reviews';
  });

  function renderProvider(locale = 'en') {
    renderToStaticMarkup(
      <GTProvider locale={locale} translations={{}}>
        content
      </GTProvider>
    );
    return mockReactGTProvider.mock.calls[0][0] as Record<string, unknown>;
  }

  it('persists locale selection in NEXT_LOCALE without the GT reset cookie', () => {
    const providerProps = renderProvider();

    expect(providerProps).toMatchObject({
      _localeCookieName: 'NEXT_LOCALE',
      _localeCookieOptions: {
        maxAge: 31_536_000,
        path: '/',
        sameSite: 'lax',
        secure: false,
      },
      _resetLocaleCookie: false,
      locale: 'en',
      translations: {},
    });
  });

  it('uses secure cookies on HTTPS and non-secure cookies on HTTP', () => {
    expect(getNextLocaleCookieOptions('https:').secure).toBe(true);
    expect(getNextLocaleCookieOptions('http:').secure).toBe(false);
  });

  it.each(['fr', 'en'])(
    'switches to %s with Next.js locale-aware navigation',
    (locale) => {
      const providerProps = renderProvider();
      const reload = providerProps._reload as (state: {
        locale: string;
      }) => void;

      reload({ locale });

      expect(mockPush).toHaveBeenCalledWith(
        '/products/[slug]',
        '/products/shoes?sort=price#reviews',
        { locale }
      );
    }
  );

  it('does not use shallow routing when changing locales', () => {
    const providerProps = renderProvider();
    const reload = providerProps._reload as (state: { locale: string }) => void;

    reload({ locale: 'fr' });

    expect(mockPush).toHaveBeenCalledWith(
      '/products/[slug]',
      '/products/shoes?sort=price#reviews',
      { locale: 'fr' }
    );
    expect(mockPush.mock.calls[0][2]).not.toHaveProperty('shallow');
  });
});
