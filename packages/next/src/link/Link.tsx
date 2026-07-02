'use client';

import NextLink from 'next/link';
import {
  forwardRef,
  type ComponentProps,
  type ComponentRef,
  type ForwardedRef,
} from 'react';
import { useLocale } from 'gt-react';

type NextLinkProps = ComponentProps<typeof NextLink>;
type LinkRef = ComponentRef<typeof NextLink>;
type LinkHref = NextLinkProps['href'];

export type LinkProps = NextLinkProps;

type ResolvedLinkProps = Omit<LinkProps, 'locale'> & {
  locale: NonNullable<LinkProps['locale']>;
};

const LinkWithLocale = forwardRef<LinkRef, Omit<LinkProps, 'locale'>>(
  function LinkWithLocale({ href, ...props }, ref) {
    const locale = useLocale();
    return renderLink({ ...props, href, locale }, ref);
  }
);

/**
 * Locale-aware wrapper around Next.js's `<Link>` component.
 *
 * Internal hrefs are prefixed with the current GT locale by default. Use this
 * component only when GT middleware locale routing is enabled. Without locale
 * routing, use `next/link` or pass `locale={false}` to leave the href
 * unchanged. External URLs are never prefixed.
 *
 * @example
 * ```tsx
 * import Link from 'gt-next/link';
 *
 * export function Navigation() {
 *   return <Link href="/home">Home</Link>; // /en/home
 * }
 * ```
 *
 * @example
 * ```tsx
 * import Link from 'gt-next/link';
 *
 * export function LocaleSwitcher() {
 *   return <Link href="/home" locale="fr">French</Link>; // /fr/home
 * }
 * ```
 *
 * @example
 * ```tsx
 * import Link from 'gt-next/link';
 *
 * export function UnlocalizedLink() {
 *   return <Link href="/legal" locale={false}>Legal</Link>; // /legal
 * }
 * ```
 *
 * @example
 * ```tsx
 * import Link from 'gt-next/link';
 *
 * export function ExternalLink() {
 *   return <Link href="https://example.com">Example</Link>; // https://example.com
 * }
 * ```
 *
 * @see https://nextjs.org/docs/app/api-reference/components/link
 * @param href - The destination URL or URL object. Internal paths are localized.
 * @param locale - Locale to prefix, or `false` to disable GT locale prefixing.
 * @returns The rendered Next.js link.
 */
export const Link = forwardRef<LinkRef, LinkProps>(function Link(
  { href, locale, ...props },
  ref
) {
  if (locale === undefined) {
    return <LinkWithLocale {...props} href={href} ref={ref} />;
  }

  return renderLink({ ...props, href, locale }, ref);
});

function renderLink(
  { href, locale, ...props }: ResolvedLinkProps,
  ref: ForwardedRef<LinkRef>
) {
  return <NextLink {...props} href={localizeHref(href, locale)} ref={ref} />;
}

function localizeHref(href: LinkHref, locale: LinkProps['locale']): LinkHref {
  if (!locale) return href;

  if (typeof href === 'string') {
    return localizePath(href, locale);
  }

  if (typeof href.pathname !== 'string') return href;

  const localizedPathname = localizePath(href.pathname, locale);
  if (localizedPathname === href.pathname) return href;

  return {
    ...href,
    pathname: localizedPathname,
  };
}

function localizePath(href: string, locale: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;

  const url = new URL(href, 'http://localhost');
  url.pathname =
    url.pathname === '/'
      ? `/${encodeURIComponent(locale)}`
      : `/${encodeURIComponent(locale)}${url.pathname}`;

  return `${url.pathname}${url.search}${url.hash}`;
}
