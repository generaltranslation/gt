import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MiddlewareConfig } from '../../middleware-dir/types';

const { mockNextLink, mockUseLocale } = vi.hoisted(() => ({
  mockNextLink: vi.fn(),
  mockUseLocale: vi.fn(),
}));

vi.mock('gt-react', () => ({
  useLocale: mockUseLocale,
  useDefaultLocale: () => 'en',
}));

vi.mock('next/link', async () => {
  const React = await import('react');

  return {
    default: React.forwardRef<HTMLAnchorElement, Record<string, unknown>>(
      function MockNextLink({ children, href, ...props }, ref) {
        mockNextLink({ ...props, href });
        return (
          <a href={href as string} ref={ref}>
            {children as React.ReactNode}
          </a>
        );
      }
    ),
  };
});

async function importLink(middlewareConfig: MiddlewareConfig = {}) {
  vi.stubEnv(
    '_GENERALTRANSLATION_MIDDLEWARE_CONFIG',
    JSON.stringify(middlewareConfig)
  );
  vi.resetModules();
  return (await import('../Link')).Link;
}

function renderedHref() {
  return mockNextLink.mock.calls[0][0].href;
}

describe('Link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocale.mockReturnValue('fr');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('prefixes internal links with the current locale without forwarding locale', async () => {
    const { Link } = await import('../Link');

    renderToStaticMarkup(<Link href='/home'>Home</Link>);

    expect(mockNextLink).toHaveBeenCalledWith({
      href: '/fr/home',
    });
    expect(mockNextLink.mock.calls[0][0]).not.toHaveProperty('locale');
  });

  it('leaves href unchanged for locale=false without forwarding locale', async () => {
    const { Link } = await import('../Link');

    renderToStaticMarkup(
      <Link href='/legal' locale={false}>
        Legal
      </Link>
    );

    expect(mockNextLink).toHaveBeenCalledWith({
      href: '/legal',
    });
    expect(mockNextLink.mock.calls[0][0]).not.toHaveProperty('locale');
  });

  it('leaves paths outside pathRegex unprefixed', async () => {
    vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '^/(?!api(?:/|$)).*');
    const Link = await importLink();

    renderToStaticMarkup(
      <>
        <Link href='/api/export'>Export</Link>
        <Link href={{ pathname: '/api/export', query: { format: 'csv' } }}>
          Export CSV
        </Link>
        <Link href='/home'>Home</Link>
      </>
    );

    expect(mockNextLink.mock.calls.map(([props]) => props.href)).toEqual([
      '/api/export',
      { pathname: '/api/export', query: { format: 'csv' } },
      '/fr/home',
    ]);
  });

  describe('default locale', () => {
    beforeEach(() => mockUseLocale.mockReturnValue('en'));

    it('leaves current default-locale links unprefixed', async () => {
      const Link = await importLink();

      renderToStaticMarkup(<Link href='/home'>Home</Link>);

      expect(renderedHref()).toBe('/home');
    });

    it('prefixes current default-locale links with prefixDefaultLocale', async () => {
      const Link = await importLink({ prefixDefaultLocale: true });

      renderToStaticMarkup(<Link href='/home'>Home</Link>);

      expect(renderedHref()).toBe('/en/home');
    });

    it('prefixes explicit default-locale links with smart routing', async () => {
      const Link = await importLink();

      renderToStaticMarkup(
        <Link href='/home' locale='en'>
          English
        </Link>
      );

      expect(renderedHref()).toBe('/en/home');
    });

    it('leaves explicit default-locale links unprefixed without smart routing', async () => {
      const Link = await importLink({ enableSmartRouting: false });

      renderToStaticMarkup(
        <Link href='/home' locale='en'>
          English
        </Link>
      );

      expect(renderedHref()).toBe('/home');
    });

    it('prefixes explicit non-default-locale links', async () => {
      const Link = await importLink({ enableSmartRouting: false });

      renderToStaticMarkup(
        <Link href='/home' locale='fr'>
          French
        </Link>
      );

      expect(renderedHref()).toBe('/fr/home');
    });
  });
});
