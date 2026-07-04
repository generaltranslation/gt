import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockNextLink, mockUseLocale } = vi.hoisted(() => ({
  mockNextLink: vi.fn(),
  mockUseLocale: vi.fn(),
}));

vi.mock('gt-react', () => ({
  useLocale: mockUseLocale,
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

describe('Link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocale.mockReturnValue('fr');
  });

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
});
